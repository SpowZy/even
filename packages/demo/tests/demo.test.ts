import { describe, expect, it } from "vitest";
import { canonicalJson } from "@even/core";
import { MemoryStore } from "@even/store";
import { seedMemoryStore, tamperDemoReceipt } from "../src/index";

describe("finance-ops demo seed", () => {
  it("processes 200 invoices into a fully verifiable chain", { timeout: 30_000 }, async () => {
    const store = new MemoryStore();
    const { run } = await seedMemoryStore(store);

    const receipts = await store.listReceipts(run.id);
    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(receipts.length);

    // 200 invoices iterated; the exact duplicate at index 178 replays
    // through the idempotency path without producing new receipts.
    const extracts = receipts.filter((r) => r.action.tool === "extract_invoice");
    expect(extracts).toHaveLength(199);

    // The injection attempt is blocked exactly once, and its evidence is
    // chained like any other receipt.
    const blocks = receipts.filter(
      (r) => r.action.tool === "send_email" && r.policy.verdict === "BLOCK",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.policy.reasons.join(" ")).toContain("blocked-tool");

    // High-value approvals are flagged for review, never auto-approved.
    const reviews = receipts.filter((r) => r.policy.verdict === "REVIEW");
    expect(reviews.length).toBeGreaterThanOrEqual(8);
    expect(reviews.every((r) => r.action.tool === "approve_payment_high_value")).toBe(true);

    // PII in invoice memos is scrubbed before it ever reaches a receipt.
    const redacted = receipts.filter((r) => r.action.redacted);
    expect(redacted.length).toBeGreaterThanOrEqual(3);
    const serialized = canonicalJson(receipts);
    expect(serialized).not.toContain("ap@brightdental.example");
    expect(serialized).not.toContain("attacker@example.com");
    expect(serialized).not.toContain("DE44500105175407324931");
    expect(serialized).not.toContain("4111");

    const closed = await store.getRun(run.id);
    expect(closed?.status).toBe("COMPLETE");
    expect(closed?.budget.spentUsd).toBeLessThanOrEqual(0.5);
    expect(closed?.budget.spentUsd).toBeGreaterThan(0);
  });

  it("tamperDemoReceipt breaks the chain at exactly the reported seq", { timeout: 30_000 }, async () => {
    const store = new MemoryStore();
    const { run } = await seedMemoryStore(store);
    const { seq } = await tamperDemoReceipt(store, run.id);
    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(seq);
  });
});
