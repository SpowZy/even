import { describe, expect, it } from "vitest";
import { GENESIS_HASH } from "@even/core";
import { MemoryStore } from "@even/store";
import {
  BudgetExceededError,
  DEFAULT_PRICING,
  PolicyBlockError,
  wrapAgent,
} from "../src/index";

describe("wrapAgent", () => {
  it("produces chained, signed receipts that verify", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      model: "gpt-4o-mini",
      budgetMaxUsd: 1,
    });

    const out = await agent.execute(
      "search",
      async () => ({ output: "hello", inputTokens: 1000, outputTokens: 500 }),
      { input: { q: "hi" } },
    );
    expect(out).toBe("hello");
    await agent.execute("calc", async () => ({ output: 42 }), { input: { n: 1 } });

    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts.length).toBe(2);
    expect(receipts[0]!.seq).toBe(1);
    expect(receipts[0]!.prevHash).toBe(GENESIS_HASH);
    expect(receipts[1]!.prevHash).toBe(receipts[0]!.hash);
    expect(receipts[0]!.policy.verdict).toBe("ALLOW");

    // gpt-4o-mini: (0.15 * 1000 + 0.6 * 500) / 1e6
    expect(receipts[0]!.cost.usd).toBeCloseTo(0.00045, 8);

    const v = await store.verifyChain(agent.run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(2);
  });

  it("enforces the budget hard-stop: throws BudgetExceededError, last receipt is BLOCK", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      model: "gpt-4o",
      budgetMaxUsd: 0.000001, // 1 micro-dollar: any real call blows it
    });

    await expect(
      agent.execute(
        "search",
        async () => ({ output: "x", inputTokens: 1000, outputTokens: 1000 }),
        { input: { q: "hi" } },
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);

    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts.length).toBe(1);
    expect(receipts[0]!.policy.verdict).toBe("BLOCK");
    expect(receipts[0]!.policy.reasons.join(" ")).toContain("budget-exceeded");

    // the BLOCK receipt is still part of the valid chain
    const v = await store.verifyChain(agent.run.id);
    expect(v.ok).toBe(true);
  });

  it("blocked tools throw PolicyBlockError with a persisted BLOCK receipt and never execute", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
      policy: { blockedTools: ["rm"] },
    });

    let executed = false;
    const err = await agent
      .execute(
        "rm",
        async () => {
          executed = true;
          return { output: "deleted" };
        },
        { input: { path: "/" } },
      )
      .catch((e) => e);

    expect(err).toBeInstanceOf(PolicyBlockError);
    expect(executed).toBe(false);
    const receipt = (err as PolicyBlockError).receipt;
    expect(receipt.policy.verdict).toBe("BLOCK");

    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts.length).toBe(1);
    expect(receipts[0]!.id).toBe(receipt.id);
    expect(receipts[0]!.policy.verdict).toBe("BLOCK");
  });

  it("redacts PII and marks the receipt", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
    });

    await agent.execute("email", async () => ({ output: "sent to bob@corp.com" }), {
      input: { to: "alice@example.com", body: "hello" },
    });

    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts[0]!.action.redacted).toBe(true);
    expect(JSON.stringify(receipts[0]!.action.input)).toContain("[REDACTED:email]");
    expect(JSON.stringify(receipts[0]!.action.input)).not.toContain("alice@example.com");
    expect(JSON.stringify(receipts[0]!.action.output)).toContain("[REDACTED:email]");
    const v = await store.verifyChain(agent.run.id);
    expect(v.ok).toBe(true);
  });

  it("REVIEW executes and flags the receipt", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
      policy: { reviewTools: ["deploy"] },
    });
    const out = await agent.execute("deploy", async () => ({ output: "shipped" }), {
      input: { env: "staging" },
    });
    expect(out).toBe("shipped");
    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts[0]!.policy.verdict).toBe("REVIEW");
  });

  it("crash-resume: re-attaching replays stored output without a new receipt", async () => {
    const store = new MemoryStore();
    // real-world flow: create the run, persist the private key
    const created = await store.createRun({
      name: "t",
      agent: "tester",
      budgetMaxUsd: 1,
    });

    const agent1 = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
      existingRunId: created.run.id,
      privateKey: created.privateKey,
    });

    let calls = 0;
    const fn = async () => {
      calls++;
      return { output: "expensive-result", inputTokens: 10, outputTokens: 10 };
    };
    const input = { q: "same input" };
    const first = await agent1.execute("llm", fn, { input });
    expect(first).toBe("expensive-result");
    expect(calls).toBe(1);

    // simulate crash: drop agent1, re-attach with the persisted key
    const agent2 = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
      existingRunId: created.run.id,
      privateKey: created.privateKey,
    });
    const second = await agent2.execute("llm", fn, { input });
    expect(second).toBe("expensive-result");
    expect(calls).toBe(1); // fn NOT re-executed

    const receipts = await store.listReceipts(created.run.id);
    expect(receipts.length).toBe(1); // no new receipt

    // a genuinely new call continues the chain
    await agent2.execute("llm", fn, { input: { q: "different" } });
    expect((await store.listReceipts(created.run.id)).length).toBe(2);
    expect((await store.verifyChain(created.run.id)).ok).toBe(true);
  });

  it("honors explicit idempotencyKey for replay", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
    });
    let calls = 0;
    const fn = async () => {
      calls++;
      return { output: "v" };
    };
    await agent.execute("a", fn, { idempotencyKey: "fixed" });
    await agent.execute("a", fn, { idempotencyKey: "fixed", input: { different: true } });
    expect(calls).toBe(1);
    expect((await store.listReceipts(agent.run.id)).length).toBe(1);
  });

  it("existingRunId without privateKey throws", async () => {
    const store = new MemoryStore();
    const created = await store.createRun({ name: "t", agent: "a", budgetMaxUsd: 1 });
    await expect(
      wrapAgent({
        store,
        runName: "t",
        agentName: "a",
        budgetMaxUsd: 1,
        existingRunId: created.run.id,
      }),
    ).rejects.toThrow(/privateKey/);
  });

  it("pricing override replaces the default table", async () => {
    expect(DEFAULT_PRICING["gpt-4o"]).toEqual({ input: 2.5, output: 10 });
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      model: "my-model",
      budgetMaxUsd: 10,
      pricing: { "my-model": { input: 1, output: 1 } },
    });
    await agent.execute(
      "llm",
      async () => ({ output: "x", inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    );
    const receipts = await store.listReceipts(agent.run.id);
    expect(receipts[0]!.cost.usd).toBeCloseTo(2, 8);
  });

  it("complete() closes the run", async () => {
    const store = new MemoryStore();
    const agent = await wrapAgent({
      store,
      runName: "t",
      agentName: "tester",
      budgetMaxUsd: 1,
    });
    await agent.complete();
    const run = await store.getRun(agent.run.id);
    expect(run?.status).toBe("COMPLETE");
    expect(run?.endedAt).toBeDefined();
  });
});
