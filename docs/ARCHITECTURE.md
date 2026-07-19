# Architecture

```
        agent code
            │
            ▼
   ┌─────────────────┐   signs with run private key (never leaves the SDK)
   │   @even/sdk     │   wrapAgent: mutex → tail read → redact → policy →
   │                 │   cost → hash → sign → append
   └────────┬────────┘
            │ fully-signed Receipt
            ▼
   ┌─────────────────┐   re-validates the chain tip on every append:
   │   @even/store   │   seq +1, prevHash = tail, unique idempotency key,
   │                 │   run still RUNNING — else typed rejection
   │  Memory │ Jsonl │   Postgres adds: SELECT … FOR UPDATE serialization,
   │  │ Postgres     │   append-only trigger, UNIQUE backstops
   └────────┬────────┘
            ▲
            │ reads + verified ingest
   ┌────────┴────────┐
   │   apps/web API  │   POST /api/receipts re-verifies hash + signature
   │                 │   before accepting; GET /verify re-walks the chain
   └────────┬────────┘
            │ SSE /api/stream
            ▼
        dashboard — live receipts, budget, chain badge, tamper demo
```

## The five invariants

1. **Single writer per run.** The SDK holds a per-run async mutex; ordering
   (`seq`, `prevHash`) is produced inside that critical section. There is no
   racy two-phase "reserve then sign" anywhere in the system.
2. **Append-only.** No update or delete path exists in any store interface.
   `PostgresStore` enforces it physically with a trigger that raises on
   `UPDATE`/`DELETE`, plus `UNIQUE(run_id, seq)` and
   `UNIQUE(run_id, idempotency_key)`.
3. **Hash linkage from genesis.** Receipt *n* commits to receipt *n−1* via
   `prevHash`; the first commits to 64 zeroes. Editing history breaks every
   link after the edit — verification names the first one.
4. **Per-run ed25519 keys.** `createRun` generates a fresh keypair, stores
   only the public key on the `Run`, and hands the private key back exactly
   once. Stores never see it; a leaked store proves nothing forgeable.
5. **Budget precedence.** The budget hard-stop outranks every other policy
   outcome. A blocked tool never executes; its BLOCK receipt is still signed
   and chained as evidence.

## Module boundaries

- `@even/core` is **pure**: types, canonical JSON, hashing, ed25519,
  redaction, policy evaluation, chain walking. No I/O, no clock beyond
  caller-supplied timestamps, no dependencies.
- `@even/store` knows persistence and chain-tip validation. It never sees
  private keys and never reimplements crypto — verification delegates to
  `@even/core`.
- `@even/sdk` is the only component that touches private keys, inside the
  mutex, in memory.
- `apps/web` is a thin adapter: HTTP concerns (auth, rate limits, zod) at
  the edge, domain logic delegated. The dashboard never recomputes crypto;
  it renders what `/verify` says.

## Data flow of one receipt

`execute(tool, fn)` → input redacted → idempotency key derived (or caller
supplied) → replay check → mutex → tail read → policy pre-check (blocked
tools short-circuit) → `fn()` runs → output redacted → cost from pricing
table → policy verdict → receipt assembled (canonical JSON) → sha256 →
ed25519 sign → `appendReceipt` (store re-validates) → run spend updated →
SSE broadcast.
