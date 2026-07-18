import type { Receipt } from "@even/core";

export function cumulativeCost(receipts: Receipt[]): number[] {
  const sorted = [...receipts].sort((a, b) => a.seq - b.seq);
  const points: number[] = [];
  let acc = 0;
  for (const receipt of sorted) {
    acc += receipt.cost.usd;
    points.push(acc);
  }
  return points;
}

export function costByTool(receipts: Receipt[]): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const receipt of receipts) {
    const tool = receipt.action.tool;
    totals.set(tool, (totals.get(tool) ?? 0) + receipt.cost.usd);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export function totalCost(receipts: Receipt[]): number {
  return receipts.reduce((sum, receipt) => sum + receipt.cost.usd, 0);
}

export function avgLatency(receipts: Receipt[]): number {
  if (receipts.length === 0) return 0;
  return receipts.reduce((sum, receipt) => sum + receipt.latencyMs, 0) / receipts.length;
}

export function blockedCount(receipts: Receipt[]): number {
  return receipts.filter((receipt) => receipt.policy.verdict === "BLOCK").length;
}
