import type { PolicyVerdict } from "./types";

export interface PolicyInput {
  tool: string;
  estimatedCostUsd: number;
  spentUsd: number;
  budgetMaxUsd: number;
  payload: unknown;
}

export interface Policy {
  blockedTools: string[];
  reviewTools: string[];
  maxPayloadBytes?: number;
}

function payloadBytes(payload: unknown): number {
  const s = JSON.stringify(payload) ?? "";
  return Buffer.byteLength(s, "utf8");
}

/**
 * Pure policy evaluator.
 * BLOCK  — tool in blockedTools, or spentUsd + estimatedCostUsd > budgetMaxUsd
 *          (the budget hard-stop always wins: it is checked first and BLOCK
 *          is never downgraded).
 * REVIEW — tool in reviewTools, or payload exceeds maxPayloadBytes.
 * ALLOW  — otherwise.
 */
export function evaluatePolicy(
  p: Policy,
  i: PolicyInput,
): { verdict: PolicyVerdict; reasons: string[] } {
  const reasons: string[] = [];
  let verdict: PolicyVerdict = "ALLOW";

  if (i.spentUsd + i.estimatedCostUsd > i.budgetMaxUsd) {
    verdict = "BLOCK";
    reasons.push(
      `budget-exceeded: spent ${i.spentUsd} + estimated ${i.estimatedCostUsd} > max ${i.budgetMaxUsd}`,
    );
  }
  if (p.blockedTools.includes(i.tool)) {
    verdict = "BLOCK";
    reasons.push(`blocked-tool: ${i.tool}`);
  }

  if (verdict !== "BLOCK") {
    if (p.reviewTools.includes(i.tool)) {
      verdict = "REVIEW";
      reasons.push(`review-tool: ${i.tool}`);
    }
    if (
      p.maxPayloadBytes !== undefined &&
      payloadBytes(i.payload) > p.maxPayloadBytes
    ) {
      verdict = "REVIEW";
      reasons.push(
        `payload-too-large: ${payloadBytes(i.payload)} bytes > max ${p.maxPayloadBytes}`,
      );
    }
  }

  return { verdict, reasons };
}
