# Security review

Self-review of the codebase as shipped, by attack surface. Severity:
high / medium / low / note. Nothing below is unverified — each finding was
checked against the code and, where stated, by a test or live request.

## API surface (`apps/web/src/app/api/**`)

| # | finding | severity | status |
| --- | --- | --- | --- |
| 1 | All mutating routes (`POST /api/runs`, `/api/receipts`, `/api/demo/*`) require `Authorization: Bearer $EVEN_API_TOKEN` | — | enforced in `src/lib/server/auth.ts`; e2e asserts 401 without it |
| 2 | The token defaults to `dev-token` when `EVEN_API_TOKEN` is unset | medium | accepted for local/demo; production deployments must set the env var. Documented in README and THREAT-MODEL |
| 3 | Write bursts hit a fixed-window limiter (30/min/IP on runs, 60/min on receipts, 10/min on demo) | — | e2e asserts a 429 within 35 authed POSTs |
| 4 | The limiter is process-local | low | documented in `ratelimit.ts`; multi-instance deployments need a shared store |
| 5 | `POST /api/receipts` re-verifies hash and ed25519 signature before appending | — | e2e asserts a forged receipt gets 400 |
| 6 | Chain-tip races on concurrent appends | low | store rejects bad seq/prevHash; Postgres serializes with `SELECT … FOR UPDATE`. Single-writer invariant documented |
| 7 | All bodies zod-validated with bounds (string lengths, numeric ranges, hash regexes) | — | e2e asserts 400 on invalid body |
| 8 | CSV export escapes `"`, `,`, `\n` in tool names | — | `csvCell` in `export.csv/route.ts` |
| 9 | SSE stream is read-only; no input surface beyond connection | — | heartbeat + cleanup on abort |
| 10 | Error responses never leak stack traces — consistent `{ error }` JSON | — | `handleError` maps typed errors; generic 500 carries only the message |

## Web surface

| # | finding | severity | status |
| --- | --- | --- | --- |
| 11 | CSP: `default-src 'self'`; fonts restricted to Fontshare/Google; `object-src 'none'`; `frame-ancestors 'none'` | — | set in `next.config.ts`; e2e asserts the header |
| 12 | `script-src` allows `'unsafe-inline'` | low | required by Next dev/HMR bootstrapping; tighten with nonces before a hardened production deploy |
| 13 | No secrets client-side. The browser demo uses the documented `dev-token` default | note | by design for the local demo |
| 14 | No cookies, no session state, no analytics — nothing to steal or leak | — | by design |
| 15 | SVG assets are static, self-authored, no scripts | — | `apps/web/public/**` |

## Ledger and crypto

| # | finding | severity | status |
| --- | --- | --- | --- |
| 16 | Receipt integrity relies on sha256 + ed25519 (Node `crypto`, no homegrown primitives) | — | core sign/verify round-trip tests |
| 17 | Run private keys are returned once at creation and never persisted by stores | — | JsonlStore keeps them in memory only; documented that production should use a KMS |
| 18 | `MemoryStore.debugTamper` bypasses all invariants | note | demo-only by design, JSDoc-marked, unreachable from API routes except `/api/demo/tamper` (authed, rate-limited) |
| 19 | Redaction is conservative: known PII shapes only | low | documented in THREAT-MODEL; fixtures prove email/IBAN/card scrubbing |
| 20 | Timestamps are not verified | note | deliberate — documented rationale |

## Dependencies

| # | finding | severity | status |
| --- | --- | --- | --- |
| 21 | `pnpm audit --prod`: 1 moderate — `postcss@8.4.31` bundled inside `next@16.2.10` (CSS-stringify XSS) | low | build-time only; no untrusted CSS is processed. Fix requires overriding Next's pinned postcss — deferred upstream |

## Verdict

No high-severity findings. The two items worth doing before a real public
deployment: set `EVEN_API_TOKEN` (2) and move to `PostgresStore` with the
migration in `packages/store/migrations/001_init.sql` (6, 17).
