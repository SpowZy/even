import { randomUUID } from "node:crypto";
import {
  canonicalJson,
  evaluatePolicy,
  hashReceipt,
  redact,
  sha256Hex,
  signHash,
} from "@even/core";
import type { Policy, PolicyVerdict, Receipt, Run } from "@even/core";
import type { Store } from "@even/store";
import pricingJson from "./pricing.json";

/** Indicative USD per 1M tokens. Defaults only — override via WrapOptions.pricing. */
export const DEFAULT_PRICING: Record<string, { input: number; output: number }> =
  pricingJson;

export interface WrapOptions {
  store: Store;
  runName: string;
  agentName: string;
  model?: string;
  budgetMaxUsd: number;
  policy?: Partial<Policy>;
  pricing?: Record<string, { input: number; output: number }>;
  /** base64 ed25519; if absent, taken from the CreatedRun flow (new runs only) */
  privateKey?: string;
  /** re-attach to an existing RUNNING run instead of creating one (crash-resume) */
  existingRunId?: string;
}

export interface WrappedAgent {
  run: Run;
  execute<T>(
    tool: string,
    fn: () => Promise<{
      output: T;
      inputTokens?: number;
      outputTokens?: number;
    }>,
    opts?: { input?: unknown; idempotencyKey?: string },
  ): Promise<T>;
  complete(status?: "COMPLETE" | "STOPPED"): Promise<void>;
}

export class PolicyBlockError extends Error {
  constructor(public readonly receipt: Receipt) {
    super(`policy blocked tool "${receipt.action.tool}": ${receipt.policy.reasons.join("; ")}`);
    this.name = "PolicyBlockError";
  }
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

/** Minimal async mutex: serializes the critical section per run. */
class Mutex {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.tail.then(fn);
    this.tail = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }
}

/**
 * Wrap an agent so every `execute` produces a signed, hash-chained receipt.
 *
 * Single-writer invariant: one WrappedAgent per run at a time; the internal
 * mutex serializes receipt production (tail read -> sign -> append), which is
 * what makes the store-side chain validation race-free.
 */
export async function wrapAgent(opts: WrapOptions): Promise<WrappedAgent> {
  const store = opts.store;
  const pricing = opts.pricing ?? DEFAULT_PRICING;
  const policy: Policy = {
    blockedTools: opts.policy?.blockedTools ?? [],
    reviewTools: opts.policy?.reviewTools ?? [],
    maxPayloadBytes: opts.policy?.maxPayloadBytes,
  };

  let run: Run;
  let privateKey: string;

  if (opts.existingRunId) {
    const existing = await store.getRun(opts.existingRunId);
    if (!existing) throw new Error(`run not found: ${opts.existingRunId}`);
    if (existing.status !== "RUNNING") {
      throw new Error(`cannot re-attach to run ${existing.id}: status is ${existing.status}`);
    }
    if (!opts.privateKey) {
      throw new Error(
        "existingRunId requires opts.privateKey — persist the run's private key at creation time",
      );
    }
    run = existing;
    privateKey = opts.privateKey;
  } else {
    const created = await store.createRun({
      name: opts.runName,
      agent: opts.agentName,
      budgetMaxUsd: opts.budgetMaxUsd,
    });
    run = created.run;
    privateKey = opts.privateKey ?? created.privateKey;
  }

  const mutex = new Mutex();
  const actor = opts.model
    ? { agent: opts.agentName, model: opts.model }
    : { agent: opts.agentName };

  async function execute<T>(
    tool: string,
    fn: () => Promise<{ output: T; inputTokens?: number; outputTokens?: number }>,
    execOpts?: { input?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const startedAt = Date.now();
    const inputRedacted = redact(execOpts?.input === undefined ? null : execOpts.input);
    const idempotencyKey =
      execOpts?.idempotencyKey ??
      `${tool}:${sha256Hex(canonicalJson(inputRedacted.value))}`;

    // Idempotent replay (crash-resume): a receipt with this key already
    // recorded the outcome — return it without re-executing.
    const prior = (await store.listReceipts(run.id)).find(
      (r) => r.idempotencyKey === idempotencyKey,
    );
    if (prior) return prior.action.output as T;

    return mutex.run(async () => {
      // re-check inside the critical section
      const receipts = await store.listReceipts(run.id);
      const again = receipts.find((r) => r.idempotencyKey === idempotencyKey);
      if (again) return again.action.output as T;

      const fresh = await store.getRun(run.id);
      if (!fresh) throw new Error(`run disappeared: ${run.id}`);
      const spentUsd = fresh.budget.spentUsd;
      const budgetMaxUsd = fresh.budget.maxUsd;

      const tail = receipts[receipts.length - 1];
      const seq = receipts.length + 1;
      const prevHash = tail ? tail.hash : fresh.genesisHash;

      const buildSigned = (fields: {
        output: unknown;
        outputRedacted: boolean;
        cost: Receipt["cost"];
        latencyMs: number;
        verdict: PolicyVerdict;
        reasons: string[];
      }): Receipt => {
        const draft: Omit<Receipt, "hash" | "signature"> = {
          id: randomUUID(),
          runId: run.id,
          seq,
          prevHash,
          timestamp: new Date().toISOString(),
          actor,
          action: {
            tool,
            input: inputRedacted.value,
            output: fields.output,
            redacted: inputRedacted.redacted || fields.outputRedacted,
          },
          cost: fields.cost,
          latencyMs: fields.latencyMs,
          policy: { verdict: fields.verdict, reasons: fields.reasons },
          idempotencyKey,
        };
        const hash = hashReceipt(draft);
        return { ...draft, hash, signature: signHash(hash, privateKey) };
      };

      // Pre-execution gate: blocked tools never run. The BLOCK receipt is
      // persisted first, then PolicyBlockError is thrown with it attached.
      if (policy.blockedTools.includes(tool)) {
        const receipt = buildSigned({
          output: null,
          outputRedacted: false,
          cost: { inputTokens: 0, outputTokens: 0, usd: 0 },
          latencyMs: Date.now() - startedAt,
          verdict: "BLOCK",
          reasons: [`blocked-tool: ${tool}`],
        });
        await store.appendReceipt(run.id, receipt);
        throw new PolicyBlockError(receipt);
      }

      const result = await fn();
      const latencyMs = Date.now() - startedAt;
      const outputRedacted = redact(result.output === undefined ? null : result.output);
      const inputTokens = result.inputTokens ?? 0;
      const outputTokens = result.outputTokens ?? 0;
      const rate = opts.model ? pricing[opts.model] : undefined;
      const usd = rate
        ? (rate.input * inputTokens + rate.output * outputTokens) / 1_000_000
        : 0;

      const verdict = evaluatePolicy(policy, {
        tool,
        estimatedCostUsd: usd,
        spentUsd,
        budgetMaxUsd,
        payload: { input: inputRedacted.value, output: outputRedacted.value },
      });

      const receipt = buildSigned({
        output: outputRedacted.value,
        outputRedacted: outputRedacted.redacted,
        cost: { inputTokens, outputTokens, usd },
        latencyMs,
        verdict: verdict.verdict,
        reasons: verdict.reasons,
      });
      await store.appendReceipt(run.id, receipt);
      // The action happened, so its cost counts against the budget even when
      // the verdict is BLOCK (the hard-stop lands on this receipt).
      await store.updateRunStatus(run.id, "RUNNING", spentUsd + usd);

      if (verdict.verdict === "BLOCK") {
        throw new BudgetExceededError(
          `budget hard-stop on run ${run.id}: ${verdict.reasons.join("; ")}`,
        );
      }
      return result.output;
    });
  }

  async function complete(status: "COMPLETE" | "STOPPED" = "COMPLETE"): Promise<void> {
    const fresh = await store.getRun(run.id);
    await store.updateRunStatus(run.id, status, fresh?.budget.spentUsd ?? 0);
  }

  return { run, execute, complete };
}
