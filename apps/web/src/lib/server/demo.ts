import type { Run } from "@even/core";
import { seedStore, tamperDemoReceipt } from "@even/demo";
import type { TamperableStore } from "@even/demo";
import { getStore } from "./store";
import { emitReceipt, emitRun } from "./bus";

function tamperable(): TamperableStore {
  const store = getStore();
  if (typeof (store as Partial<TamperableStore>).debugTamper !== "function") {
    throw new Error("the configured store does not support the tamper demo");
  }
  return store as TamperableStore;
}

/** Run the scripted finance-ops agent and broadcast everything it did. */
export async function seedDemo(): Promise<{ run: Run }> {
  const store = getStore();
  const { run } = await seedStore(store);
  const receipts = await store.listReceipts(run.id);
  emitRun(run);
  for (const receipt of receipts) emitReceipt(receipt);
  const closed = await store.getRun(run.id);
  if (closed) emitRun(closed);
  return { run: closed ?? run };
}

/** Flip bytes at rest inside the ledger — verification must catch it. */
export async function tamperDemo(runId: string): Promise<{ tamperedSeq: number }> {
  const { seq } = await tamperDemoReceipt(tamperable(), runId);
  return { tamperedSeq: seq };
}
