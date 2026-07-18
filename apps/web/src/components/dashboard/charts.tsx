"use client";

import type { Receipt } from "@even/core";
import { usd } from "@/lib/format";

const W = 320;
const H = 72;

/** Cumulative spend over the run, as a hand-rolled SVG sparkline. */
export function CostSparkline({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length < 2) {
    return <p className="py-6 text-center text-xs text-muted">not enough data yet</p>;
  }
  let acc = 0;
  const points = receipts.map((r) => (acc += r.cost.usd));
  const max = points[points.length - 1] || 1;
  const stepX = W / (points.length - 1);
  const path = points
    .map((y, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(H - (y / max) * (H - 8) - 4).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="cumulative cost">
        <path d={path} fill="none" stroke="var(--color-primary-soft)" strokeWidth="1.5" />
        <path d={`${path} L${W},${H} L0,${H} Z`} fill="var(--color-primary)" opacity="0.08" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>seq 1</span>
        <span className="font-mono">{usd(max)}</span>
        <span>seq {receipts.length}</span>
      </div>
    </div>
  );
}

/** Spend per tool, sorted desc, hand-rolled SVG bars. */
export function CostBars({ receipts }: { receipts: Receipt[] }) {
  const byTool = new Map<string, number>();
  for (const r of receipts) {
    byTool.set(r.action.tool, (byTool.get(r.action.tool) ?? 0) + r.cost.usd);
  }
  const rows = [...byTool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted">no receipts yet</p>;
  }
  const max = rows[0]![1] || 1;

  return (
    <div className="space-y-2">
      {rows.map(([tool, value]) => (
        <div key={tool} className="flex items-center gap-2">
          <span className="w-40 truncate font-mono text-[11px] text-muted">{tool}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-sm bg-border">
            <div className="h-full bg-primary" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
          </div>
          <span className="w-20 text-right font-mono text-[11px]">{usd(value)}</span>
        </div>
      ))}
    </div>
  );
}
