import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashReceipt, signHash } from "@even/core";
import type { Receipt } from "@even/core";
import {
  DuplicateIdempotencyError,
  JsonlStore,
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

let dir: string;
let store: JsonlStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "even-jsonl-"));
  store = new JsonlStore(dir);
});

afterEach(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});

async function storeWithRun() {
  const { run, privateKey } = await store.createRun({
    name: "t",
    agent: "tester",
    budgetMaxUsd: 1,
  });
  return { run, privateKey };
}

describe("JsonlStore", () => {
  it("creates runs and appends a verifiable chain", async () => {
    const { run, privateKey } = await storeWithRun();
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );
    const r2 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 2, r1.hash, privateKey),
    );
    expect(r2.seq).toBe(2);
    const v = await store.verifyChain(run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(2);
  });

  it("rejects seq gaps, prevHash mismatch, duplicate keys and closed runs", async () => {
    const { run, privateKey } = await storeWithRun();
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );

    await expect(
      store.appendReceipt(run.id, signedReceipt(run.id, 3, r1.hash, privateKey)),
    ).rejects.toBeInstanceOf(SeqGapError);
    await expect(
      store.appendReceipt(run.id, signedReceipt(run.id, 2, run.genesisHash, privateKey)),
    ).rejects.toBeInstanceOf(PrevHashMismatchError);
    await expect(
      store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey, "key-1")),
    ).rejects.toBeInstanceOf(DuplicateIdempotencyError);
    await expect(
      store.appendReceipt(
        crypto.randomUUID(),
        signedReceipt(run.id, 2, r1.hash, privateKey),
      ),
    ).rejects.toBeInstanceOf(RunNotFoundError);

    await store.updateRunStatus(run.id, "COMPLETE", 0.5);
    await expect(
      store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey)),
    ).rejects.toBeInstanceOf(RunClosedError);

    const closed = await store.getRun(run.id);
    expect(closed?.status).toBe("COMPLETE");
    expect(closed?.budget.spentUsd).toBe(0.5);
    expect(closed?.endedAt).toBeDefined();
  });

  it("survives a restart: state replays from disk and the chain still verifies", async () => {
    const { run, privateKey } = await storeWithRun();
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );
    await store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey));
    await store.updateRunStatus(run.id, "RUNNING", 0.25);
    await store.close();

    const revived = new JsonlStore(dir);
    const v = await revived.verifyChain(run.id);
    expect(v.ok).toBe(true);
    expect(v.verified).toBe(2);
    expect((await revived.getRun(run.id))?.budget.spentUsd).toBe(0.25);

    // The chain tip survived too: seq 3 must link to the persisted tail.
    const tail = (await revived.listReceipts(run.id)).at(-1)!;
    await revived.appendReceipt(run.id, signedReceipt(run.id, 3, tail.hash, privateKey));
    expect((await revived.verifyChain(run.id)).verified).toBe(3);
    await revived.close();
  });

  it("detects on-disk tampering after reload", async () => {
    const { run, privateKey } = await storeWithRun();
    const r1 = await store.appendReceipt(
      run.id,
      signedReceipt(run.id, 1, run.genesisHash, privateKey),
    );
    await store.appendReceipt(run.id, signedReceipt(run.id, 2, r1.hash, privateKey));
    await store.close();

    // Flip one byte in the first receipt's payload on disk.
    const { readFile, writeFile } = await import("node:fs/promises");
    const file = join(dir, `receipts-${run.id}.jsonl`);
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    const first = JSON.parse(lines[0]!) as Receipt;
    first.action.output = { r: 999 };
    lines[0] = JSON.stringify(first);
    await writeFile(file, lines.join("\n") + "\n", "utf8");

    const revived = new JsonlStore(dir);
    const v = await revived.verifyChain(run.id);
    expect(v.ok).toBe(false);
    expect(v.brokenAtSeq).toBe(1);
    await revived.close();
  });
});
