export type Hash = string; // lowercase hex sha256, 64 chars
export type PolicyVerdict = "ALLOW" | "BLOCK" | "REVIEW";
export type RunStatus = "RUNNING" | "COMPLETE" | "CRASHED" | "STOPPED";

export interface Receipt {
  id: string; // uuid v4
  runId: string;
  seq: number; // 1-based, strictly monotonic per run
  prevHash: Hash; // hash of previous receipt; genesis = 64 zeros
  hash: Hash; // sha256 over canonical JSON of receipt minus hash/signature
  signature: string; // ed25519 signature over hash, base64
  timestamp: string; // ISO 8601
  actor: { agent: string; model?: string };
  action: { tool: string; input: unknown; output: unknown; redacted: boolean };
  cost: { inputTokens: number; outputTokens: number; usd: number };
  latencyMs: number;
  policy: { verdict: PolicyVerdict; reasons: string[] };
  idempotencyKey: string; // unique per (runId, key)
}

export interface Run {
  id: string;
  name: string;
  agent: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  budget: { maxUsd: number; spentUsd: number };
  genesisHash: Hash;
  publicKey: string; // ed25519 public key, base64 — verifies all receipts of the run
}

export interface ChainVerification {
  ok: boolean;
  runId: string;
  totalReceipts: number;
  verified: number; // receipts whose hash+signature+prevHash link checked out
  brokenAtSeq?: number; // first seq where the chain breaks
  reason?: string;
  verifiedAt: string;
}
