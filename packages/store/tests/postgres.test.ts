import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hashReceipt, signHash } from "@even/core";
import type { Receipt } from "@even/core";
import { PostgresStore } from "../src/index";

// Integration test against a real Postgres. Gated on DATABASE_URL:
//   DATABASE_URL=postgres://localhost/even pnpm --filter @even/store test
const DATABASE_URL = process.env.DATABASE_URL;
const describePg = DATABASE_URL ? describe : describe.skip;

function signedReceipt(
  runId: string,
  seq: number,
  prevHash: string,
  privateKey: string,
): Receipt {
  const draft: Omit<Receipt, "hash" | "signature"> = {
    id: crypto.randomUUID(),
    runId,
    seq,
    prevHash,
    timestamp: new Date().toISOString(),
    actor: { agent: "tester" },
    action: { tool: "pay", input: { n: seq }, output: { ok: true }, redacted: false },
    cost: { inputTokens: 0, outputTokens: 0, usd: 0 },
    latencyMs: 1,
    policy: { verdict: "ALLOW", reasons: [] },
    idempotencyKey: `key-${seq}`,
  };
  const hash = hashReceipt(draft);
  return { ...draft, hash, signature: signHash(hash, privateKey) };
}

describePg("PostgresStore (requires DATABASE_URL)", () => {
  it("appends, verifies and enforces DB-level append-only", async () => {
    const store = new PostgresStore(DATABASE_URL!);
    const sql = await readFile(join(__dirname, "..", "migrations", "001_init.sql"), "utf8");
    await (store as unknown as { pool: { query: (s: string) => Promise<unknown> } }).pool.query(sql);

    const { run, privateKey } = await store.createRun({
      name: "pg-it",
      agent: "tester",
      budgetMaxUsd: 1,
    });
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );
    await store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey));

    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(2);

    // The trigger must reject mutation of stored receipts.
    await expect(
      (store as unknown as { pool: { query: (s: string) => Promise<unknown> } }).pool.query(
        `UPDATE receipts SET hash = '0' WHERE run_id = '${run.id}'`,
      ),
    ).rejects.toThrow(/append-only/);

    await store.end();
  });
});
