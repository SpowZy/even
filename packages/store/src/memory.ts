import { randomUUID } from "node:crypto";
import { GENESIS_HASH, generateRunKeyPair, verifyReceipts } from "@even/core";
import type { ChainVerification, Receipt, Run, RunStatus } from "@even/core";
import type { CreatedRun, Store } from "./contract.js";
import {
  DuplicateIdempotencyError,
  PrevHashMismatchError,
  RunClosedError,
  RunNotFoundError,
  SeqGapError,
} from "./errors.js";

/**
 * In-memory append-only store. Process-local: state is lost on restart.
 * Powers the hosted demo and tests; use JsonlStore for local durability or
 * PostgresStore for real deployments.
 */
export class MemoryStore implements Store {
  private readonly runs = new Map<string, Run>();
  private readonly receipts = new Map<string, Receipt[]>();

  async createRun(input: {
    name: string;
    agent: string;
    budgetMaxUsd: number;
  }): Promise<CreatedRun> {
    const { publicKey, privateKey } = generateRunKeyPair();
    const run: Run = {
      id: randomUUID(),
      name: input.name,
      agent: input.agent,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      budget: { maxUsd: input.budgetMaxUsd, spentUsd: 0 },
      genesisHash: GENESIS_HASH,
      publicKey,
    };
    this.runs.set(run.id, run);
    this.receipts.set(run.id, []);
    return { run, privateKey };
  }

  async getRun(id: string): Promise<Run | null> {
    return this.runs.get(id) ?? null;
  }

  async listRuns(): Promise<Run[]> {
    return [...this.runs.values()];
  }

  async appendReceipt(runId: string, signed: Receipt): Promise<Receipt> {
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    if (run.status !== "RUNNING") throw new RunClosedError(runId, run.status);

    const list = this.receipts.get(runId)!;
    const expectedSeq = list.length + 1;
    if (signed.seq !== expectedSeq) throw new SeqGapError(expectedSeq, signed.seq);

    const tail = list[list.length - 1];
    const expectedPrev = tail ? tail.hash : run.genesisHash;
    if (signed.prevHash !== expectedPrev) throw new PrevHashMismatchError(signed.seq);

    if (list.some((r) => r.idempotencyKey === signed.idempotencyKey)) {
      throw new DuplicateIdempotencyError(signed.idempotencyKey);
    }

    list.push(signed);
    return signed;
  }

  async listReceipts(runId: string): Promise<Receipt[]> {
    if (!this.runs.has(runId)) throw new RunNotFoundError(runId);
    return [...(this.receipts.get(runId) ?? [])];
  }

  async verifyChain(runId: string): Promise<ChainVerification> {
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    return verifyReceipts(run, this.receipts.get(runId) ?? []);
  }

  async updateRunStatus(
    runId: string,
    status: RunStatus,
    spentUsd: number,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    run.status = status;
    run.budget.spentUsd = spentUsd;
    if (status !== "RUNNING" && run.endedAt === undefined) {
      run.endedAt = new Date().toISOString();
    }
  }

  /**
   * DEMO ONLY — simulates an attacker flipping bytes at rest.
   *
   * Replaces the stored receipt at `seq` with `mutate(receipt)` WITHOUT
   * recomputing its hash or re-signing it, so the next `verifyChain()`
   * fails at exactly that seq. This exists to power the tamper-evidence
   * demo; it deliberately bypasses every append-time invariant. Never
   * call it from real code paths.
   */
  debugTamper(runId: string, seq: number, mutate: (r: Receipt) => Receipt): void {
    const list = this.receipts.get(runId);
    if (!list) throw new RunNotFoundError(runId);
    const idx = list.findIndex((r) => r.seq === seq);
    if (idx === -1) throw new Error(`no receipt at seq ${seq} in run ${runId}`);
    list[idx] = mutate(list[idx]!);
  }
}
