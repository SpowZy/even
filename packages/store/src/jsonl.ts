import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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

type RunEvent =
  | { t: "run"; run: Run }
  | { t: "status"; runId: string; status: RunStatus; spentUsd: number; endedAt?: string };

/**
 * Local-durable append-only store backed by JSON Lines files:
 *   <dataDir>/runs.jsonl              one event per line (run created / status change)
 *   <dataDir>/receipts-<runId>.jsonl  one receipt per line
 *
 * State is replayed into memory at construction; every mutation appends a
 * line before returning. Private keys are held in memory only — after a
 * restart, re-attach to a run by passing its persisted private key to the
 * SDK (real deployments should source it from a KMS, not disk).
 */
export class JsonlStore implements Store {
  private readonly runs = new Map<string, Run>();
  private readonly receipts = new Map<string, Receipt[]>();
  private readonly privateKeys = new Map<string, string>();
  private readonly ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.ready = this.load();
  }

  private get runsFile(): string {
    return join(this.dataDir, "runs.jsonl");
  }

  private receiptsFile(runId: string): string {
    return join(this.dataDir, `receipts-${runId}.jsonl`);
  }

  private async load(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    let runLines: string[] = [];
    try {
      runLines = (await readFile(this.runsFile, "utf8"))
        .split("\n")
        .filter((l) => l.trim().length > 0);
    } catch {
      runLines = []; // first boot: no index yet
    }
    for (const line of runLines) {
      const event = JSON.parse(line) as RunEvent;
      if (event.t === "run") {
        this.runs.set(event.run.id, event.run);
        this.receipts.set(event.run.id, []);
      } else {
        const run = this.runs.get(event.runId);
        if (run) {
          run.status = event.status;
          run.budget.spentUsd = event.spentUsd;
          if (event.endedAt) run.endedAt = event.endedAt;
        }
      }
    }
    for (const runId of this.receipts.keys()) {
      let lines: string[] = [];
      try {
        lines = (await readFile(this.receiptsFile(runId), "utf8"))
          .split("\n")
          .filter((l) => l.trim().length > 0);
      } catch {
        lines = [];
      }
      this.receipts.set(runId, lines.map((l) => JSON.parse(l) as Receipt));
    }
  }

  /** Serializes all writes so concurrent appends never interleave on disk. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn);
    this.queue = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }

  private async appendJsonl(file: string, value: unknown): Promise<void> {
    await appendFile(file, JSON.stringify(value) + "\n", "utf8");
  }

  async createRun(input: {
    name: string;
    agent: string;
    budgetMaxUsd: number;
  }): Promise<CreatedRun> {
    await this.ready;
    return this.enqueue(async () => {
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
      const event: RunEvent = { t: "run", run };
      await this.appendJsonl(this.runsFile, event);
      this.runs.set(run.id, run);
      this.receipts.set(run.id, []);
      this.privateKeys.set(run.id, privateKey);
      return { run, privateKey };
    });
  }

  async getRun(id: string): Promise<Run | null> {
    await this.ready;
    return this.runs.get(id) ?? null;
  }

  async listRuns(): Promise<Run[]> {
    await this.ready;
    return [...this.runs.values()];
  }

  async appendReceipt(runId: string, signed: Receipt): Promise<Receipt> {
    await this.ready;
    return this.enqueue(async () => {
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

      await this.appendJsonl(this.receiptsFile(runId), signed);
      list.push(signed);
      return signed;
    });
  }

  async listReceipts(runId: string): Promise<Receipt[]> {
    await this.ready;
    if (!this.runs.has(runId)) throw new RunNotFoundError(runId);
    return [...(this.receipts.get(runId) ?? [])];
  }

  async verifyChain(runId: string): Promise<ChainVerification> {
    await this.ready;
    const run = this.runs.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    return verifyReceipts(run, this.receipts.get(runId) ?? []);
  }

  async updateRunStatus(
    runId: string,
    status: RunStatus,
    spentUsd: number,
  ): Promise<void> {
    await this.ready;
    return this.enqueue(async () => {
      const run = this.runs.get(runId);
      if (!run) throw new RunNotFoundError(runId);
      run.status = status;
      run.budget.spentUsd = spentUsd;
      let endedAt: string | undefined;
      if (status !== "RUNNING" && run.endedAt === undefined) {
        endedAt = new Date().toISOString();
        run.endedAt = endedAt;
      }
      const event: RunEvent = { t: "status", runId, status, spentUsd, endedAt };
      await this.appendJsonl(this.runsFile, event);
    });
  }

  /** Flush pending writes. Call before process exit. */
  async close(): Promise<void> {
    await this.ready;
    await this.queue;
  }
}
