# @even/store

Store interface plus the in-memory reference implementation.

## The append protocol (read this before writing a second implementation)

`appendReceipt(runId, signed)` takes a **fully signed** `Receipt`. The store
never sees a private key and never assigns `seq`/`prevHash` itself. Ordering is
produced by the writer, under this invariant:

> **Single writer per run.** The SDK holds a per-run async mutex. Inside the
> critical section it reads the chain tail (`listReceipts(runId)` last item),
> derives `seq = tail.seq + 1` and `prevHash = tail.hash` (genesis = 64 zeroes
> for the first receipt), computes `hash` and `signature` locally, then calls
> `appendReceipt`.

Because hashing and signing happen inside the writer's critical section, there
is no racy two-phase "reserve position, then sign" dance, and private keys
never flow into stores.

The store is the second line of defense: on every append it re-validates the
chain tip and rejects with typed errors:

| condition                              | error                        |
| -------------------------------------- | ---------------------------- |
| `seq` is not exactly `tail.seq + 1`    | `SeqGapError`                |
| `prevHash` does not match stored tail  | `PrevHashMismatchError`      |
| `idempotencyKey` already used in run   | `DuplicateIdempotencyError`  |
| run is not `RUNNING`                   | `RunClosedError`             |
| run does not exist                     | `RunNotFoundError`           |

## `createRun` returns the private key exactly once

`createRun` generates the run's ed25519 keypair via `@even/core`, stores only
the public key on the `Run`, and returns `{ run, privateKey }` (`CreatedRun`).
The caller (SDK / API layer) **must persist the private key** at run-creation
time — it is required to re-attach to a run after a crash. The store cannot
recover it.

## `verifyChain`

Delegates to `verifyReceipts` from `@even/core`: seq contiguity from 1,
prevHash linkage from `run.genesisHash`, recomputed hash equality, and ed25519
signature validity against `run.publicKey`.

## MemoryStore

Process-local `Map`-backed implementation. Data is lost on restart; use it
for dev, tests, and the hosted demo (selection point:
`apps/web/src/lib/server/store.ts`).

`MemoryStore` also exposes `debugTamper(runId, seq, mutate)` — **demo only**.
It replaces a stored receipt without re-hashing or re-signing, simulating an
attacker flipping bytes at rest so the next `verifyChain()` localizes the
exact broken link. Never call it from real code paths.

## JsonlStore

Local-durable implementation backed by JSON Lines files:
`runs.jsonl` (run + status events) and one `receipts-<runId>.jsonl` per run.
State replays into memory at construction; every mutation appends a line
first. Private keys stay in memory — after a restart, re-attach by passing
the run's persisted private key to the SDK. All writes are serialized through
an internal queue. Call `close()` before process exit.

```ts
import { JsonlStore } from "@even/store";
const store = new JsonlStore("data/demo");
```

## PostgresStore

Production implementation (`pg`). Chain integrity is enforced twice: the
append transaction serializes writers with `SELECT ... FOR UPDATE` on the
run row, and the database itself is append-only — a trigger rejects every
`UPDATE`/`DELETE` on `receipts`, with `UNIQUE(run_id, seq)` and
`UNIQUE(run_id, idempotency_key)` backstopping the chain and replay
invariants.

```bash
psql $DATABASE_URL -f packages/store/migrations/001_init.sql
```

```ts
import { PostgresStore } from "@even/store";
const store = new PostgresStore(process.env.DATABASE_URL!);
```

The integration test is gated on `DATABASE_URL` and skips cleanly without it.
