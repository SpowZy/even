"use client";

export default function EmptyState({
  onSeed,
  seeding,
  pickRun,
}: {
  onSeed: () => void;
  seeding: boolean;
  pickRun?: boolean;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface/50 p-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={40} height={40} className="mb-5 opacity-90" />
      <h2 className="text-lg font-semibold tracking-tight">
        {pickRun ? "Pick a run on the left" : "No runs yet"}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {pickRun
          ? "Select a run to inspect its receipts, costs and chain integrity."
          : "Fire the demo finance-ops agent: 200 invoices, one blocked injection, and a receipt chain you can verify — and break."}
      </p>
      {!pickRun && (
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="mt-6 rounded-card bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {seeding ? "Running demo agent…" : "Run demo agent"}
        </button>
      )}
    </div>
  );
}
