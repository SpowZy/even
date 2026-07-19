# Failure analysis

Every row names the test or code path that proves the behavior. Run
`pnpm test` to re-verify all of it.

| failure | system behavior | proof |
| --- | --- | --- |
| Crash mid-run | Re-attach with `existingRunId` + the run's persisted private key; the chain resumes from the stored tail, no gaps | sdk crash-resume test: re-attach and continue, chain verifies |
| Duplicate tool execution after crash | The retry's idempotency key already exists → stored output returned, `fn` never re-runs, no new receipt | sdk idempotent-replay test |
| Tampered middle receipt | `verifyChain` → `ok:false`, `brokenAtSeq` = edited seq, reason `hash mismatch` | store tamper test; demo test; on-disk JSONL tamper test |
| Deleted middle receipt | Linkage break: next receipt's `prevHash` no longer matches → localized at that seq | core chain-walker test |
| Forged signature | `verifyHashSignature` fails; API ingest rejects with 400 `bad_signature` | core sign/verify tests; receipts route re-verification |
| Seq gap submitted | Store rejects with `SeqGapError` before anything is written | store rejection tests (memory + JSONL) |
| Duplicate idempotency key submitted | `DuplicateIdempotencyError`; Postgres backstops with the UNIQUE constraint | store rejection tests |
| Append to a completed run | `RunClosedError` — runs are append-only while `RUNNING` | store rejection tests |
| Budget exceeded mid-run | Hard-stop outranks all policy: `BudgetExceededError`; the BLOCK receipt is signed and chained, spend includes it | sdk budget test |
| Blocked tool invoked | Tool never executes; BLOCK receipt persisted; `PolicyBlockError` carries the receipt | sdk blocked-tool test; demo injection fixture |
| Oversized / hostile payloads | Redaction walks all payload strings before receipt assembly; API bodies are zod-validated with bounds | core redact tests; demo PII assertions |
| Clock skew | Ignored by design: verification never checks timestamps | documented in THREAT-MODEL |
| Process-local state loss (MemoryStore) | Everything gone on restart — expected; use `JsonlStore` (replays from disk) or `PostgresStore` | JsonlStore restart test |
| SSE client disconnect | Heartbeat every 15 s; unsubscribe + stream close on abort; browser `EventSource` auto-reconnects with backoff | `apps/web/src/app/api/stream/route.ts` |
