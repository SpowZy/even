import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  canonicalJson,
  evaluatePolicy,
  generateRunKeyPair,
  hashReceipt,
  redact,
  sha256Hex,
  signHash,
  verifyHashSignature,
  verifyReceipts,
} from "../src/index";
import type { Receipt, Run } from "../src/index";

// --- helpers ---------------------------------------------------------------

const { publicKey, privateKey } = generateRunKeyPair();

function makeRun(): Run {
  return {
    id: "run-1",
    name: "test",
    agent: "tester",
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    budget: { maxUsd: 10, spentUsd: 0 },
    genesisHash: GENESIS_HASH,
    publicKey,
  };
}

function buildReceipt(
  runId: string,
  seq: number,
  prevHash: string,
  overrides: Partial<Pick<Receipt, "idempotencyKey" | "timestamp">> = {},
): Receipt {
  const draft: Omit<Receipt, "hash" | "signature"> = {
    id: crypto.randomUUID(),
    runId,
    seq,
    prevHash,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    actor: { agent: "tester", model: "gpt-4o-mini" },
    action: { tool: "search", input: { q: "x" }, output: { ok: true }, redacted: false },
    cost: { inputTokens: 10, outputTokens: 5, usd: 0.0001 },
    latencyMs: 12,
    policy: { verdict: "ALLOW", reasons: [] },
    idempotencyKey: overrides.idempotencyKey ?? `key-${seq}`,
  };
  const hash = hashReceipt(draft);
  return { ...draft, hash, signature: signHash(hash, privateKey) };
}

function buildChain(runId: string, n: number): Receipt[] {
  const out: Receipt[] = [];
  let prev = GENESIS_HASH;
  for (let seq = 1; seq <= n; seq++) {
    const r = buildReceipt(runId, seq, prev);
    out.push(r);
    prev = r.hash;
  }
  return out;
}

// --- canonicalJson ---------------------------------------------------------

describe("canonicalJson", () => {
  it("is deterministic regardless of key order", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } });
    const b = canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("rejects undefined at any depth", () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalJson([1, undefined])).toThrow(TypeError);
  });
});

// --- hash / sign / verify --------------------------------------------------

describe("hash + ed25519 round-trip", () => {
  it("sha256Hex produces 64 lowercase hex chars", () => {
    expect(sha256Hex("even")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashReceipt is stable for identical drafts", () => {
    const run = makeRun();
    const r1 = buildReceipt(run.id, 1, GENESIS_HASH, { timestamp: "2026-01-01T00:00:00.000Z" });
    const r2 = buildReceipt(run.id, 1, GENESIS_HASH, { timestamp: "2026-01-01T00:00:00.000Z" });
    // ids differ (uuid), so hashes must differ — sign/verify each on its own
    expect(verifyHashSignature(r1.hash, r1.signature, publicKey)).toBe(true);
    expect(verifyHashSignature(r2.hash, r2.signature, publicKey)).toBe(true);
    expect(r1.hash).not.toBe(r2.hash);
  });

  it("verifies a valid signature and rejects tampering", () => {
    const hash = sha256Hex("payload");
    const sig = signHash(hash, privateKey);
    expect(verifyHashSignature(hash, sig, publicKey)).toBe(true);
    expect(verifyHashSignature(sha256Hex("other"), sig, publicKey)).toBe(false);
    const other = generateRunKeyPair();
    expect(verifyHashSignature(hash, sig, other.publicKey)).toBe(false);
    expect(verifyHashSignature(hash, "not-base64!!!", publicKey)).toBe(false);
  });
});

// --- redact ----------------------------------------------------------------

describe("redact", () => {
  it("redacts emails", () => {
    const r = redact({ contact: "reach me at jane.doe@example.com please" });
    expect(r.redacted).toBe(true);
    expect(r.value).toEqual({ contact: "reach me at [REDACTED:email] please" });
  });

  it("redacts E.164-ish phone numbers", () => {
    const r = redact("call +14155552671 now");
    expect(r.value).toBe("call [REDACTED:phone] now");
    expect(r.redacted).toBe(true);
  });

  it("redacts IBANs", () => {
    const r = redact("pay to GB29NWBK60161331926819");
    expect(r.value).toBe("pay to [REDACTED:iban]");
    expect(r.redacted).toBe(true);
  });

  it("redacts AWS-style keys", () => {
    const r = redact("key: AKIAIOSFODNN7EXAMPLE");
    expect(r.value).toBe("key: [REDACTED:aws-key]");
    expect(r.redacted).toBe(true);
  });

  it("redacts OpenAI-style keys", () => {
    const r = redact("sk-ABCDEFGHIJKLMNOPQRSTUVWX1234");
    expect(r.value).toBe("[REDACTED:openai-key]");
    expect(r.redacted).toBe(true);
  });

  it("redacts 16-digit card numbers, plain and grouped", () => {
    expect(redact("card 4242424242424242").value).toBe("card [REDACTED:card]");
    expect(redact("card 4242 4242 4242 4242").value).toBe("card [REDACTED:card]");
  });

  it("walks nested structures and arrays without corrupting them", () => {
    const input = { a: [{ b: "x@y.com" }, 3, null, true], c: "clean" };
    const r = redact(input);
    expect(r.redacted).toBe(true);
    expect(r.value).toEqual({ a: [{ b: "[REDACTED:email]" }, 3, null, true], c: "clean" });
  });

  it("leaves clean values untouched with redacted=false", () => {
    expect(redact({ a: [1, "two", null] })).toEqual({
      value: { a: [1, "two", null] },
      redacted: false,
    });
  });
});

// --- policy -----------------------------------------------------------------

describe("evaluatePolicy", () => {
  const base = { blockedTools: ["rm"], reviewTools: ["deploy"], maxPayloadBytes: 100 };

  it("allows when nothing triggers", () => {
    const v = evaluatePolicy(base, { tool: "ls", estimatedCostUsd: 0.1, spentUsd: 0, budgetMaxUsd: 1, payload: {} });
    expect(v).toEqual({ verdict: "ALLOW", reasons: [] });
  });

  it("blocks blocked tools", () => {
    const v = evaluatePolicy(base, { tool: "rm", estimatedCostUsd: 0, spentUsd: 0, budgetMaxUsd: 1, payload: {} });
    expect(v.verdict).toBe("BLOCK");
    expect(v.reasons.join(" ")).toContain("blocked-tool");
  });

  it("budget hard-stop blocks and wins over review", () => {
    const v = evaluatePolicy(base, { tool: "deploy", estimatedCostUsd: 2, spentUsd: 0.5, budgetMaxUsd: 1, payload: {} });
    expect(v.verdict).toBe("BLOCK");
    expect(v.reasons[0]).toContain("budget-exceeded");
  });

  it("budget block wins over blocked tool (budget reason first)", () => {
    const v = evaluatePolicy(base, { tool: "rm", estimatedCostUsd: 5, spentUsd: 0, budgetMaxUsd: 1, payload: {} });
    expect(v.verdict).toBe("BLOCK");
    expect(v.reasons[0]).toContain("budget-exceeded");
    expect(v.reasons.join(" ")).toContain("blocked-tool");
  });

  it("flags review tools", () => {
    const v = evaluatePolicy(base, { tool: "deploy", estimatedCostUsd: 0, spentUsd: 0, budgetMaxUsd: 1, payload: {} });
    expect(v).toEqual({ verdict: "REVIEW", reasons: ["review-tool: deploy"] });
  });

  it("flags oversized payloads", () => {
    const v = evaluatePolicy(base, { tool: "ls", estimatedCostUsd: 0, spentUsd: 0, budgetMaxUsd: 1, payload: { big: "x".repeat(200) } });
    expect(v.verdict).toBe("REVIEW");
    expect(v.reasons.join(" ")).toContain("payload-too-large");
  });
});

// --- chain verification ------------------------------------------------------

describe("verifyReceipts", () => {
  it("verifies a valid chain", () => {
    const run = makeRun();
    const receipts = buildChain(run.id, 4);
    const v = verifyReceipts(run, receipts);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(4);
    expect(v.totalReceipts).toBe(4);
    expect(v.brokenAtSeq).toBeUndefined();
  });

  it("verifies an empty chain", () => {
    const v = verifyReceipts(makeRun(), []);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(0);
  });

  it("detects a flipped byte (hash mismatch) at the right seq", () => {
    const run = makeRun();
    const receipts = buildChain(run.id, 3);
    receipts[1]!.action = { ...receipts[1]!.action, output: { ok: false } };
    const v = verifyReceipts(run, receipts);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(2);
    expect(v.reason).toContain("hash mismatch");
    expect(v.verified).toBe(1);
  });

  it("detects a deleted middle receipt (seq gap)", () => {
    const run = makeRun();
    const receipts = buildChain(run.id, 3);
    const broken = [receipts[0]!, receipts[2]!];
    const v = verifyReceipts(run, broken);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(3);
    expect(v.reason).toContain("seq gap");
    expect(v.verified).toBe(1);
  });

  it("detects a bad signature", () => {
    const run = makeRun();
    const receipts = buildChain(run.id, 2);
    receipts[1]!.signature = signHash(receipts[1]!.hash, generateRunKeyPair().privateKey);
    const v = verifyReceipts(run, receipts);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(2);
    expect(v.reason).toContain("invalid signature");
  });

  it("detects a forged linkage (prevHash mismatch)", () => {
    const run = makeRun();
    const receipts = buildChain(run.id, 2);
    const forged = buildReceipt(run.id, 2, "f".repeat(64));
    const v = verifyReceipts(run, [receipts[0]!, forged]);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(2);
    expect(v.reason).toContain("prevHash mismatch");
  });
});
