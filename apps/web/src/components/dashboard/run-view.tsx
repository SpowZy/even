"use client";

import type { ChainVerification, Receipt, Run } from "@even/core";
import { cn, usd } from "@/lib/format";
import { CostBars, CostSparkline } from "./charts";

const STATUS_CHIP: Record<Run["status"], string> = {
  RUNNING: "border-primary/50 text-primary-soft",
  COMPLETE: "border-success/50 text-success",
  CRASHED: "border-danger/50 text-danger",
  STOPPED: "border-muted/50 text-muted",
};

export default function RunView({
  run,
  receipts,
  verification,
  loading,
  busy,
  onTamper,
  onReverify,
}: {
  run: Run;
  receipts: Receipt[];
  verification: ChainVerification | null;
  loading: boolean;
  busy: "seed" | "tamper" | null;
  onTamper: () => void;
  onReverify: () => void;
}) {
  const pct = Math.min(100, (run.budget.spentUsd / run.budget.maxUsd) * 100);
  const blocked = receipts.filter((r) => r.policy.verdict === "BLOCK").length;
  const avgLatency =
    receipts.length > 0
      ? Math.round(receipts.reduce((s, r) => s + r.latencyMs, 0) / receipts.length)
      : 0;
  const totalUsd = receipts.reduce((s, r) => s + r.cost.usd, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{run.name}</h1>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            STATUS_CHIP[run.status],
          )}
        >
          {run.status}
        </span>

        <ChainBadge verification={verification} onReverify={onReverify} />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onTamper}
            disabled={busy !== null}
            className="rounded-card border border-danger/50 px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
          >
            {busy === "tamper" ? "Tampering…" : "Simulate tampering"}
          </button>
          <a
            href={`/api/runs/${run.id}/export.csv`}
            className="rounded-card border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text transition-colors hover:border-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Export CFO CSV
          </a>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>budget</span>
          <span>
            {usd(run.budget.spentUsd)} / {usd(run.budget.maxUsd)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className={cn("h-full transition-[width]", pct > 90 ? "bg-danger" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="receipts" value={String(receipts.length)} />
        <Stat label="cost" value={usd(totalUsd)} />
        <Stat label="avg latency" value={`${avgLatency} ms`} />
        <Stat label="blocked" value={String(blocked)} danger={blocked > 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="mb-2 text-xs text-muted">cumulative cost</div>
          <CostSparkline receipts={receipts} />
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="mb-2 text-xs text-muted">cost by tool</div>
          <CostBars receipts={receipts} />
        </div>
      </div>

      {loading && <p className="text-xs text-muted">refreshing…</p>}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-lg", danger && "text-danger")}>{value}</div>
    </div>
  );
}

function ChainBadge({
  verification,
  onReverify,
}: {
  verification: ChainVerification | null;
  onReverify: () => void;
}) {
  if (!verification) {
    return (
      <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
        verifying…
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onReverify}
      title="Re-run verification"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
        verification.ok
          ? "border-success/50 text-success focus-visible:outline-success"
          : "border-danger/50 text-danger focus-visible:outline-danger",
      )}
    >
      {verification.ok ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          CHAIN VERIFIED · {verification.verified}
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          CHAIN BROKEN at seq {verification.brokenAtSeq}
        </>
      )}
    </button>
  );
}
