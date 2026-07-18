import { MemoryStore } from "@even/store";
import type { Run } from "@even/core";
import { seedMemoryStore, tamperDemoReceipt } from "@even/demo";
import { getStore } from "./store";
import { emitReceipt, emitRun } from "./bus";

function demoStore(): MemoryStore {
  const store = getStore();
  if (!(store instanceof MemoryStore)) {
    throw new Error("demo endpoints require the in-memory store");
  }
  return store;
}

/** Run the scripted finance-ops agent and broadcast everything it did. */
export async function seedDemo(): Promise<{ run: Run }> {
  const store = demoStore();
  const { run } = await seedMemoryStore(store);
  const receipts = await store.listReceipts(run.id);
  emitRun(run);
  for (const receipt of receipts) emitReceipt(receipt);
  const closed = await store.getRun(run.id);
  if (closed) emitRun(closed);
  return { run: closed ?? run };
}

/** Flip bytes at rest inside the ledger — verification must catch it. */
export async function tamperDemo(runId: string): Promise<{ tamperedSeq: number }> {
  const store = demoStore();
  const { seq } = await tamperDemoReceipt(store, runId);
  return { tamperedSeq: seq };
}
