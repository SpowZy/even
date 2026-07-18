"use client";

import type { Run } from "@even/core";
import { cn, fmtDateTime, usd } from "@/lib/format";

const STATUS_DOT: Record<Run["status"], string> = {
  RUNNING: "bg-primary-soft animate-pulse",
  COMPLETE: "bg-success",
  CRASHED: "bg-danger",
  STOPPED: "bg-muted",
};

export default function RunRail({
  runs,
  selectedId,
  onSelect,
  onSeed,
  seeding,
}: {
  runs: Run[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeed: () => void;
  seeding: boolean;
}) {
  return (
    <aside className="w-full shrink-0 md:w-72">
      <button
        type="button"
        onClick={onSeed}
        disabled={seeding}
        className="mb-4 w-full rounded-card bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {seeding ? "Running demo agent…" : "Run demo agent"}
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
        {(runs ?? []).map((run) => {
          const pct = Math.min(100, (run.budget.spentUsd / run.budget.maxUsd) * 100);
          const active = run.id === selectedId;
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => onSelect(run.id)}
              aria-current={active}
              className={cn(
                "w-56 shrink-0 rounded-card border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-full",
                active
                  ? "border-primary/60 bg-elevated"
                  : "border-border bg-surface hover:border-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[run.status])} />
                <span className="truncate text-sm font-medium">{run.name}</span>
              </div>
              <div className="mt-1 truncate text-xs text-muted">
                {run.agent} · {fmtDateTime(run.startedAt)}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className={cn("h-full", pct > 90 ? "bg-danger" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {usd(run.budget.spentUsd)} / {usd(run.budget.maxUsd)}
              </div>
            </button>
          );
        })}
        {runs !== null && runs.length === 0 && (
          <p className="px-1 text-xs text-muted">No runs yet.</p>
        )}
      </div>
    </aside>
  );
}
