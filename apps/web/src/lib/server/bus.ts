import { EventEmitter } from "node:events";
import type { Receipt, Run } from "@even/core";

export type BusEvent =
  | { type: "receipt"; data: Receipt }
  | { type: "run"; data: Run };

const EVENT = "even";

// Process-local event bus. Cached on globalThis so Next dev HMR keeps the
// same instance; a multi-instance deployment would replace this with Redis
// pub/sub or Postgres LISTEN/NOTIFY.
const globalForBus = globalThis as unknown as { __evenBus?: EventEmitter };

function getBus(): EventEmitter {
  if (!globalForBus.__evenBus) {
    globalForBus.__evenBus = new EventEmitter();
    globalForBus.__evenBus.setMaxListeners(0); // unbounded SSE subscribers
  }
  return globalForBus.__evenBus;
}

export function emitReceipt(receipt: Receipt): void {
  getBus().emit(EVENT, { type: "receipt", data: receipt } satisfies BusEvent);
}

export function emitRun(run: Run): void {
  getBus().emit(EVENT, { type: "run", data: run } satisfies BusEvent);
}

export function subscribe(listener: (event: BusEvent) => void): () => void {
  const bus = getBus();
  bus.on(EVENT, listener);
  return () => {
    bus.off(EVENT, listener);
  };
}
