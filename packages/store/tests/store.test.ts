import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  hashReceipt,
  signHash,
} from "@even/core";
import type { Receipt } from "@even/core";
import {
  DuplicateIdempotencyError,
  MemoryStore,
  PrevHashMismatchError,
  RunClosedError,
  RunNotFoundError,
  SeqGapError,
} from "../src/index";

function signedReceipt(
  runId: string,
  seq: number,
  prevHash: string,
  privateKey: string,
  idempotencyKey = `key-${seq}`,
): Receipt {
  const draft: Omit<Receipt, "hash" | "signature"> = {
    id: crypto.randomUUID(),
    runId,
    seq,
    prevHash,
    timestamp: new Date().toISOString(),
    actor: { agent: "tester" },
    action: { tool: "search", input: { q: seq }, output: { r: seq }, redacted: false },
    cost: { inputTokens: 1, outputTokens: 1, usd: 0.000001 },
    latencyMs: 1,
    policy: { verdict: "ALLOW", reasons: [] },
    idempotencyKey,
  };
  const hash = hashReceipt(draft);
  return { ...draft, hash, signature: signHash(hash, privateKey) };
}

async function storeWithRun() {
  const store = new MemoryStore();
  const { run, privateKey } = await store.createRun({
    name: "t",
    agent: "tester",
    budgetMaxUsd: 1,
  });
  return { store, run, privateKey };
}

describe("MemoryStore happy path", () => {
  it("creates runs with a public key and zeroed budget", async () => {
    const { store, run } = await storeWithRun();
    expect(run.status).toBe("RUNNING");
    expect(run.genesisHash).toBe(GENESIS_HASH);
    expect(run.publicKey.length).toBeGreaterThan(0);
    expect(run.budget.spentUsd).toBe(0);
    expect(await store.getRun(run.id)).toEqual(run);
    expect((await store.listRuns()).map((r) => r.id)).toContain(run.id);
  });

  it("appends a signed chain and verifies it", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r1 = signedReceipt(run.id, 1, GENESIS_HASH, privateKey);
    const r2 = signedReceipt(run.id, 2, r1.hash, privateKey);
    await store.appendReceipt(run.id, r1);
    await store.appendReceipt(run.id, r2);
    expect((await store.listReceipts(run.id)).length).toBe(2);
    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(2);
  });

  it("updates status and spend, stamping endedAt on close", async () => {
    const { store, run } = await storeWithRun();
    await store.updateRunStatus(run.id, "COMPLETE", 0.5);
    const after = await store.getRun(run.id);
    expect(after?.status).toBe("COMPLETE");
    expect(after?.budget.spentUsd).toBe(0.5);
    expect(after?.endedAt).toBeDefined();
  });
});

describe("MemoryStore rejections", () => {
  it("rejects a seq gap with SeqGapError", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r = signedReceipt(run.id, 5, GENESIS_HASH, privateKey);
    await expect(store.appendReceipt(run.id, r)).rejects.toBeInstanceOf(SeqGapError);
  });

  it("rejects a prevHash mismatch with PrevHashMismatchError", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r = signedReceipt(run.id, 1, "f".repeat(64), privateKey);
    await expect(store.appendReceipt(run.id, r)).rejects.toBeInstanceOf(
      PrevHashMismatchError,
    );
  });

  it("rejects a duplicate idempotencyKey with DuplicateIdempotencyError", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r1 = signedReceipt(run.id, 1, GENESIS_HASH, privateKey, "same-key");
    await store.appendReceipt(run.id, r1);
    const r2 = signedReceipt(run.id, 2, r1.hash, privateKey, "same-key");
    await expect(store.appendReceipt(run.id, r2)).rejects.toBeInstanceOf(
      DuplicateIdempotencyError,
    );
  });

  it("rejects appends to a non-RUNNING run with RunClosedError", async () => {
    const { store, run, privateKey } = await storeWithRun();
    await store.updateRunStatus(run.id, "COMPLETE", 0);
    const r = signedReceipt(run.id, 1, GENESIS_HASH, privateKey);
    await expect(store.appendReceipt(run.id, r)).rejects.toBeInstanceOf(RunClosedError);
  });

  it("rejects appends to an unknown run with RunNotFoundError", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r = signedReceipt(run.id, 1, GENESIS_HASH, privateKey);
    await expect(store.appendReceipt("no-such-run", r)).rejects.toBeInstanceOf(
      RunNotFoundError,
    );
  });
});

describe("MemoryStore.verifyChain tamper detection", () => {
  it("detects an externally mutated receipt with the correct brokenAtSeq", async () => {
    const { store, run, privateKey } = await storeWithRun();
    const r1 = signedReceipt(run.id, 1, GENESIS_HASH, privateKey);
    const r2 = signedReceipt(run.id, 2, r1.hash, privateKey);
    await store.appendReceipt(run.id, r1);
    await store.appendReceipt(run.id, r2);

    // simulate out-of-band tampering: mutate the stored object directly
    const stored = await store.listReceipts(run.id);
    stored[0]!.action = { ...stored[0]!.action, output: { r: "tampered" } };

    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(1);
    expect(v.reason).toContain("hash mismatch");
    expect(v.verified).toBe(0);
  });
});
