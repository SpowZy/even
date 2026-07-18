import { describe, expect, it } from "vitest";
import { hashReceipt, signHash } from "@even/core";
import type { Receipt } from "@even/core";
import { MemoryStore } from "../src/index";

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

describe("MemoryStore.debugTamper (demo-only)", () => {
  it("flips bytes at rest so verifyChain localizes the exact broken link", async () => {
    const store = new MemoryStore();
    const { run, privateKey } = await store.createRun({
      name: "t",
      agent: "tester",
      budgetMaxUsd: 1,
    });
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );
    await store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey));

    expect((await store.verifyChain(run.id)).ok).toBe(true);

    store.debugTamper(run.id, 1, (r) => ({
      ...r,
      action: { ...r.action, output: { ok: false } },
    }));

    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(1);
  });
});
