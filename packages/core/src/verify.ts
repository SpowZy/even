import { hashReceipt } from "./hash";
import { verifyHashSignature } from "./keys";
import type { ChainVerification, Receipt, Run } from "./types";

/**
 * Pure chain walker. Checks, in seq order starting at 1:
 *   1. seq contiguity (1, 2, 3, ...)
 *   2. prevHash linkage (first receipt anchors at run.genesisHash)
 *   3. recomputed hash equality (content integrity)
 *   4. ed25519 signature validity against run.publicKey
 * Timestamps are NOT verified. First failure short-circuits with
 * ok:false, brokenAtSeq and a human-readable reason.
 */
export function verifyReceipts(run: Run, receipts: Receipt[]): ChainVerification {
  const verifiedAt = new Date().toISOString();
  const sorted = [...receipts].sort((a, b) => a.seq - b.seq);
  let prev = run.genesisHash;
  let verified = 0;

  const fail = (r: Receipt, reason: string): ChainVerification => ({
    ok: false,
    runId: run.id,
    totalReceipts: receipts.length,
    verified,
    brokenAtSeq: r.seq,
    reason,
    verifiedAt,
  });

  for (let idx = 0; idx < sorted.length; idx++) {
    const r = sorted[idx]!;
    const expectedSeq = idx + 1;
    if (r.seq !== expectedSeq) {
      return fail(r, `seq gap: expected seq ${expectedSeq}, got ${r.seq}`);
    }
    if (r.prevHash !== prev) {
      return fail(r, `prevHash mismatch at seq ${r.seq}: chain link broken`);
    }
    const { hash, signature, ...unsigned } = r;
    if (hashReceipt(unsigned) !== hash) {
      return fail(r, `hash mismatch at seq ${r.seq}: content tampered`);
    }
    if (!verifyHashSignature(hash, signature, run.publicKey)) {
      return fail(r, `invalid signature at seq ${r.seq}`);
    }
    prev = hash;
    verified++;
  }

  return {
    ok: true,
    runId: run.id,
    totalReceipts: receipts.length,
    verified,
    verifiedAt,
  };
}
