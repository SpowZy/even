# @even/sdk

`wrapAgent` — the receipt-producing wrapper around an agent's tool/LLM calls.

```ts
import { MemoryStore } from "@even/store";
import { wrapAgent } from "@even/sdk";

const store = new MemoryStore();
const agent = await wrapAgent({
  store,
  runName: "nightly",
  agentName: "researcher",
  model: "gpt-4o-mini",
  budgetMaxUsd: 0.5,
  policy: { blockedTools: ["rm"], reviewTools: ["deploy"] },
});

const out = await agent.execute(
  "search",
  async () => ({ output: "...", inputTokens: 120, outputTokens: 40 }),
  { input: { q: "even receipts" } },
);
await agent.complete();
```

Every `execute`:

1. redacts PII/secrets from input and output (`@even/core` `redact`),
2. short-circuits on idempotency-key replay (see below),
3. refuses to run blocked tools — persists a `BLOCK` receipt, then throws
   `PolicyBlockError` with that receipt attached,
4. runs the function, computes cost from the pricing table,
5. evaluates policy (budget hard-stop) and appends the signed, hash-chained
   receipt inside a per-run async mutex (single-writer invariant),
6. on a budget `BLOCK`: persists the receipt, updates spend, then throws
   `BudgetExceededError`. `REVIEW` still executes and returns normally, with
   the verdict flagged on the receipt.

## Pricing

`src/pricing.json` holds **indicative defaults** (USD per 1M tokens) for a
handful of models. They are not authoritative — pass
`WrapOptions.pricing` to override the whole table with your negotiated rates.
Unknown models price at 0 and are still fully receipted.

## Idempotency and crash-resume

The default idempotency key is `` `${tool}:${sha256(canonicalJson(redacted input))}` ``;
pass `opts.idempotencyKey` to control it. If a receipt with that key already
exists in the run, `execute` returns the **stored output without
re-executing** — that is the crash-resume mechanism: after a crash, re-attach
and re-issue the same calls; completed ones replay instantly and the chain
continues where it stopped.

Re-attaching needs the run's private key:

```ts
// at creation time — persist created.privateKey somewhere durable:
const created = await store.createRun({ name, agent, budgetMaxUsd });
await wrapAgent({ store, existingRunId: created.run.id, privateKey: created.privateKey, ... });
```

Real deployments must persist the private key at run creation; stores keep
only the public key and cannot recover it. `wrapAgent` with `existingRunId`
throws if no `privateKey` is supplied, and refuses runs that are not
`RUNNING`.

## Single-writer invariant

One `WrappedAgent` per run at a time. The internal mutex serializes
tail-read -> sign -> append, so `seq`/`prevHash` are race-free and the store's
chain-tip validation (`SeqGapError`, `PrevHashMismatchError`, …) never fires
under normal operation. Do not share a run between two concurrent writers.
