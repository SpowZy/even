import { MemoryStore, PostgresStore } from "@even/store";
import type { Store } from "@even/store";

// Store selection: PostgresStore when DATABASE_URL is set (production),
// MemoryStore otherwise (local dev and tests). Cached on globalThis so Next
// dev HMR does not reset in-memory state.
const globalForStore = globalThis as unknown as { __evenStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__evenStore) {
    globalForStore.__evenStore = process.env.DATABASE_URL
      ? new PostgresStore(process.env.DATABASE_URL)
      : new MemoryStore();
  }
  return globalForStore.__evenStore;
}
