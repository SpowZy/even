import type { ChainVerification, Receipt, Run, RunStatus } from "@even/core";

/** Result of createRun: the Run plus its private key, handed back exactly once. */
export interface CreatedRun {
  run: Run;
  privateKey: string; // base64 ed25519 — the caller MUST persist it; stores never keep it
}

/**
 * Append-only receipt store.
 *
 * Signing protocol (single-writer-per-run): the writer (SDK) holds a per-run
 * async mutex, reads the chain tail to learn the next seq/prevHash, computes
 * hash+signature locally, and appends the fully-signed Receipt. The store
 * never sees private keys. It re-validates the chain tip on every append and
 * rejects: seq gaps, prevHash mismatches, duplicate idempotency keys, and
 * appends to non-RUNNING runs.
 */
export interface Store {
  createRun(input: {
    name: string;
    agent: string;
    budgetMaxUsd: number;
  }): Promise<CreatedRun>;
  getRun(id: string): Promise<Run | null>;
  listRuns(): Promise<Run[]>;
  appendReceipt(runId: string, signed: Receipt): Promise<Receipt>;
  listReceipts(runId: string): Promise<Receipt[]>;
  verifyChain(runId: string): Promise<ChainVerification>;
  updateRunStatus(runId: string, status: RunStatus, spentUsd: number): Promise<void>;
}
