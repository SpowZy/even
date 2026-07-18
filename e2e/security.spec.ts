import { test, expect } from "@playwright/test";

test("writes require a bearer token", async ({ request }) => {
  const res = await request.post("/api/receipts", { data: {} });
  expect(res.status()).toBe(401);

  const runs = await request.post("/api/runs", {
    data: { name: "x", agent: "y", budgetMaxUsd: 1 },
  });
  expect(runs.status()).toBe(401);
});

test("invalid bodies are rejected with 400", async ({ request }) => {
  const res = await request.post("/api/runs", {
    headers: { Authorization: "Bearer dev-token" },
    data: { name: "", agent: "y", budgetMaxUsd: -3 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe("invalid_body");
});

test("forged receipts are rejected before ingestion", async ({ request }) => {
  const auth = { Authorization: "Bearer dev-token" };
  const created = await request.post("/api/runs", {
    headers: auth,
    data: { name: "forgery-target", agent: "tester", budgetMaxUsd: 1 },
  });
  const { run } = await created.json();

  const forged = {
    id: crypto.randomUUID(),
    runId: run.id,
    seq: 1,
    prevHash: run.genesisHash,
    hash: "0".repeat(64),
    signature: "forged",
    timestamp: new Date().toISOString(),
    actor: { agent: "mallory" },
    action: { tool: "pay", input: null, output: null, redacted: false },
    cost: { inputTokens: 0, outputTokens: 0, usd: 0 },
    latencyMs: 0,
    policy: { verdict: "ALLOW", reasons: [] },
    idempotencyKey: "forge-1",
  };
  const res = await request.post("/api/receipts", { headers: auth, data: forged });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(["hash_mismatch", "bad_signature"]).toContain(body.error);
});

test("rate limiting kicks in on write bursts", async ({ request }) => {
  const auth = { Authorization: "Bearer dev-token" };
  const statuses: number[] = [];
  for (let i = 0; i < 35; i++) {
    const res = await request.post("/api/runs", {
      headers: auth,
      data: { name: `burst-${i}`, agent: "tester", budgetMaxUsd: 1 },
    });
    statuses.push(res.status());
  }
  expect(statuses).toContain(429);
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
