import type { RunStatus } from "@even/core";

// --- typed errors ------------------------------------------------------------

export class SeqGapError extends Error {
  constructor(expected: number, got: number) {
    super(`seq gap: expected seq ${expected}, got ${got}`);
    this.name = "SeqGapError";
  }
}

export class PrevHashMismatchError extends Error {
  constructor(seq: number) {
    super(`prevHash mismatch at seq ${seq}: does not match stored chain tail`);
    this.name = "PrevHashMismatchError";
  }
}

export class DuplicateIdempotencyError extends Error {
  constructor(key: string) {
    super(`duplicate idempotencyKey in run: ${key}`);
    this.name = "DuplicateIdempotencyError";
  }
}

export class RunClosedError extends Error {
  constructor(runId: string, status: RunStatus) {
    super(`run ${runId} is ${status}: append rejected (runs are append-only while RUNNING)`);
    this.name = "RunClosedError";
  }
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`run not found: ${runId}`);
    this.name = "RunNotFoundError";
  }
}
