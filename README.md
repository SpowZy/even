# even

<p align="center">
  <img src="apps/web/public/icon.svg" alt="even logo" width="72" height="72" />
</p>

<p align="center"><strong>every agent action, accounted for.</strong></p>

<p align="center">
  <!-- build status placeholder -->
  <img alt="build" src="https://img.shields.io/badge/build-passing-brightgreen" />
  <!-- tests placeholder -->
  <img alt="tests" src="https://img.shields.io/badge/tests-52%20passing-brightgreen" />
  <img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue" />
</p>

even is an open-source receipt layer for AI agents. Every tool call and LLM
call an agent makes produces a signed, hash-chained receipt: a double-entry
ledger for autonomous work. It gives you per-action cost attribution, policy
guardrails with budget hard-stops, tamper-evident chain verification,
crash-resume via idempotency, and a live dashboard.

## The receipt

```json
{
  "seq": 7,
  "prevHash": "9f2c…a1",
  "hash": "4bd7…e3",
  "signature": "Zm9vYmFy…",
  "cost": { "inputTokens": 812, "outputTokens": 154, "usd": 0.0041 }
}
```

One receipt per action. Each receipt embeds the previous receipt's sha256 hash
(genesis = 64 zeroes); the hash is computed over canonical JSON (keys sorted
recursively, no whitespace) of the receipt minus `hash`/`signature`. Each
receipt is signed ed25519; the run's public key is stored on the `Run` and
verifies the whole chain. Every receipt carries a policy verdict (`ALLOW`,
`BLOCK`, `REVIEW`) with reasons, and an idempotency key: replaying a completed
call returns its stored output without re-executing.

## Why receipts, not logs

Logs are mutable. They can be edited, truncated, rotated, or lost, and nothing
notices. Receipts are evidence:

- **signed**: ed25519 per receipt, one keypair per run; a forged receipt
  fails signature verification
- **chained**: each receipt commits to its predecessor's hash; altering or
  deleting any receipt breaks every link after it
- **verifiable**: anyone holding the run's public key can verify the full
  chain offline and get the exact `seq` of the first broken link

A log tells you what the system says happened. A receipt chain proves what was
recorded, in what order, and whether anything was touched since.

## How it compares

Existing observability tools are good at traces, prompts, and dashboards. even
is not a replacement; it adds the layer they don't have: tamper-evidence and
per-action financial accountability.

| tool      | what it does well                                   | what even adds                                                        |
| --------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| LangSmith | deep LangChain tracing, evals, debugging            | receipts that stand on their own: signed, hash-chained, exportable    |
| Langfuse  | open-source LLM observability, cost tracking        | hard budget stops enforced before execution, not reported after       |
| Helicone  | proxy-based LLM logging, caching, rate limits       | per-action policy verdicts (blocked tools, PII redaction) in the trail |
| AgentOps  | agent session replay and analytics                  | cryptographic proof the session record was not modified after the fact |

## Quickstart

```bash
pnpm install && pnpm build && pnpm dev
```

Open http://localhost:3000/app and click **Run demo agent**.

The demo walks through the four moments that matter:

1. **live run**: receipts stream in as the agent works, each with cost,
   latency, and a policy verdict
2. **blocked injection**: a tool call the policy forbids is stopped before
   execution; the `BLOCK` receipt is still written to the chain
3. **tamper**: click *Simulate tampering*; chain verification turns red and
   names the exact `seq` of the broken link
4. **crash-resume**: implemented in the SDK and proven by tests: re-attach
   to a crashed run and completed calls replay from stored outputs instead of
   re-executing (the demo's exact-duplicate invoice exercises the same path)

## Workspace layout

```
packages/core    receipt types, canonical JSON, sha256, ed25519, redaction,
                 policy evaluator, chain verifier (pure, zero-dependency)
packages/store   Store interface + MemoryStore, JsonlStore (local durability),
                 PostgresStore (append-only enforced by trigger + constraints)
packages/sdk     wrapAgent: redact -> policy -> sign -> append, idempotency,
                 crash-resume, pricing table
packages/demo    scripted finance-ops agent over fixtures/ (200 invoices,
                 mixed formats, PII, one prompt injection, exact duplicates)
apps/web         Next.js 16 landing + operations dashboard + API routes
fixtures/        vendors.json, invoices.json (deterministic generator:
                 pnpm --filter @even/demo gen:fixtures)
docs/            ARCHITECTURE, THREAT-MODEL, FAILURE-ANALYSIS, design system
```

**Cross-package imports use built `dist`.** Each `@even/*` package builds with
`tsc` (`main`/`types` → `dist`, `declaration: true`) and consumers import the
package name only (`import { wrapAgent } from "@even/sdk"`), never deep paths
into `src`. The Next app consumes the built output the same way (no
`transpilePackages`). Consequences:

- after editing `packages/*`, run `pnpm build` (or let `pnpm dev` do it; its
  `predev` builds core/store/sdk first)
- `pnpm install` runs `postinstall`, which builds all packages once
- tests resolve the same built output, so they exercise exactly what consumers
  get

## Security model

- **Hash chain**: sha256 over canonical JSON; deleting or altering any
  receipt breaks every link after it
- **Signatures**: ed25519 per receipt; one keypair per run; the private key
  is returned once at creation and never stored by the store
- **Append-only**: the store rejects seq gaps, prevHash mismatches, duplicate
  idempotency keys, and writes to closed runs
- **Single writer per run**: the SDK serializes tail-read → sign → append
  under a per-run mutex; one `WrappedAgent` per run at a time
- **Redaction at the edge**: emails, phones, IBANs, card numbers, AWS and
  OpenAI keys are scrubbed before anything is persisted
- **Write auth**: mutating API routes require
  `Authorization: Bearer $EVEN_API_TOKEN`

## Scripts

| command      | what it does                                  |
| ------------ | --------------------------------------------- |
| `pnpm dev`   | build packages, then Next dev server          |
| `pnpm build` | build all packages and the web app            |
| `pnpm test`  | Vitest suites in every package                |
| `pnpm lint`  | `tsc --noEmit` in every package               |
| `pnpm e2e`   | Playwright (chromium) against the dev server  |

## Roadmap

- Python SDK
- hosted public demo (selection point: `apps/web/src/lib/server/store.ts`
  swaps `MemoryStore` for `PostgresStore` when `DATABASE_URL` is set)

## License

MIT
