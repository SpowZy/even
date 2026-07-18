import { NextResponse } from "next/server";
import { z } from "zod";
import { hashReceipt, verifyHashSignature } from "@even/core";
import type { Receipt } from "@even/core";
import { requireWriteAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { getStore } from "@/lib/server/store";
import { clientIp, handleError, jsonError, rateLimited } from "@/lib/server/http";
import { emitReceipt } from "@/lib/server/bus";

export const dynamic = "force-dynamic";

const HASH_RE = /^[0-9a-f]{64}$/;

const receiptSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  seq: z.number().int().positive(),
  prevHash: z.string().regex(HASH_RE),
  hash: z.string().regex(HASH_RE),
  signature: z.string().min(1),
  timestamp: z.string().min(1),
  actor: z.object({ agent: z.string().min(1), model: z.string().optional() }),
  action: z.object({
    tool: z.string().min(1),
    input: z.unknown(),
    output: z.unknown(),
    redacted: z.boolean(),
  }),
  cost: z.object({
    inputTokens: z.number().nonnegative(),
    outputTokens: z.number().nonnegative(),
    usd: z.number().nonnegative(),
  }),
  latencyMs: z.number().nonnegative(),
  policy: z.object({
    verdict: z.enum(["ALLOW", "BLOCK", "REVIEW"]),
    reasons: z.array(z.string()),
  }),
  idempotencyKey: z.string().min(1).max(512),
});

// POST /api/receipts — ingest a signed receipt. Trust story: the server
// re-verifies the evidence before accepting it — recomputed hash equality,
// ed25519 signature against the run's public key, then the store's own
// chain-tip validation. Forged or tampered receipts never enter the ledger.
export async function POST(req: Request) {
  try {
    requireWriteAuth(req);
    if (!checkRateLimit(`receipts:${clientIp(req)}`, 60, 60_000)) return rateLimited();

    const receipt = receiptSchema.parse(await req.json()) as Receipt;
    const store = getStore();
    const run = await store.getRun(receipt.runId);
    if (!run) return jsonError("run_not_found", 404);

    const { hash, signature, ...draft } = receipt;
    if (hashReceipt(draft) !== hash) return jsonError("hash_mismatch", 400);
    if (!verifyHashSignature(hash, signature, run.publicKey)) {
      return jsonError("bad_signature", 400);
    }

    const stored = await store.appendReceipt(receipt.runId, receipt);
    emitReceipt(stored);
    return NextResponse.json({ receipt: stored }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
