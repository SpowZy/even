/**
 * Seed the finance-ops demo into a local-durable JsonlStore at data/demo/.
 *   pnpm --filter @even/demo seed
 */
import { JsonlStore } from "@even/store";
import { seedStore } from "./agent.js";

const store = new JsonlStore("data/demo");
const { run } = await seedStore(store);
const receipts = await store.listReceipts(run.id);
const verification = await store.verifyChain(run.id);
await store.close();

const blocked = receipts.filter((r) => r.policy.verdict === "BLOCK").length;
const review = receipts.filter((r) => r.policy.verdict === "REVIEW").length;
const redacted = receipts.filter((r) => r.action.redacted).length;

console.log(
  JSON.stringify(
    {
      run: {
        id: run.id,
        name: run.name,
        status: run.status,
        spentUsd: run.budget.spentUsd,
        budgetMaxUsd: run.budget.maxUsd,
      },
      receipts: receipts.length,
      verdicts: { blocked, review, redacted },
      chain: { ok: verification.ok, verified: verification.verified },
    },
    null,
    2,
  ),
);

process.exit(verification.ok ? 0 : 1);
