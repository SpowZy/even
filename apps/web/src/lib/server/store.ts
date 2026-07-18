import { MemoryStore } from "@even/store";
import type { Store } from "@even/store";

// Store selection point. When PostgresStore lands (see roadmap), switch on
// DATABASE_URL here:
//   const store = process.env.DATABASE_URL
//     ? new PostgresStore(process.env.DATABASE_URL)
//     : new MemoryStore();
// Cached on globalThis so Next dev HMR does not reset in-memory state.
const globalForStore = globalThis as unknown as { __evenStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__evenStore) {
    globalForStore.__evenStore = new MemoryStore();
  }
  return globalForStore.__evenStore;
}
