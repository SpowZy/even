"use client";

import { useEffect, useState } from "react";
import type { Receipt } from "@even/core";
import { cn, shortHash, usd } from "@/lib/format";

const VERDICT_CHIP: Record<Receipt["policy"]["verdict"], string> = {
  ALLOW: "border-primary/50 text-primary-soft",
  REVIEW: "border-warn/50 text-warn",
  BLOCK: "border-danger/50 text-danger",
};

export default function ReceiptsTable({
  receipts,
  brokenAtSeq,
}: {
  receipts: Receipt[];
  brokenAtSeq?: number;
}) {
  const [open, setOpen] = useState<Receipt | null>(null);

  if (receipts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-10 text-center text-sm text-muted">
        No receipts in this run yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-elevated text-xs text-muted">
              <tr>
                <Th>seq</Th>
                <Th>hash</Th>
                <Th>tool</Th>
                <Th className="text-right">cost</Th>
                <Th className="text-right">tokens</Th>
                <Th className="text-right">latency</Th>
                <Th>verdict</Th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {receipts.map((r) => {
                const broken = brokenAtSeq !== undefined && r.seq === brokenAtSeq;
                return (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => setOpen(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setOpen(r);
                    }}
                    className={cn(
                      "cursor-pointer border-t border-border transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary",
                      broken && "bg-danger/10 outline-1 outline-danger",
                    )}
                  >
                    <Td>{r.seq}</Td>
                    <Td className="text-muted">{shortHash(r.hash)}</Td>
                    <Td>
                      {r.action.tool}
                      {r.action.redacted && (
                        <span className="ml-2 rounded-full border border-warn/40 px-1.5 py-px text-[10px] text-warn">
                          redacted
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">{usd(r.cost.usd)}</Td>
                    <Td className="text-right text-muted">
                      {r.cost.inputTokens}/{r.cost.outputTokens}
                    </Td>
                    <Td className="text-right text-muted">{r.latencyMs} ms</Td>
                    <Td>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          VERDICT_CHIP[r.policy.verdict],
                        )}
                      >
                        {r.policy.verdict}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ReceiptDrawer receipt={open} broken={open.seq === brokenAtSeq} onClose={() => setOpen(null)} />}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function ReceiptDrawer({
  receipt,
  broken,
  onClose,
}: {
  receipt: Receipt;
  broken: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`receipt ${receipt.seq}`}
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="h-full w-full max-w-xl overflow-auto border-l border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">receipt #{receipt.seq}</h2>
            {broken && (
              <span className="rounded-full border border-danger/50 px-2 py-0.5 text-[11px] text-danger">
                tampered
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <HashRow label="hash" value={receipt.hash} />
          <HashRow label="prevHash" value={receipt.prevHash} />
          <HashRow label="signature" value={receipt.signature} />
          <div className="rounded-card border border-border bg-bg p-3 text-xs">
            <div className="mb-1 text-muted">policy</div>
            <div className="font-mono">
              {receipt.policy.verdict}
              {receipt.policy.reasons.length > 0 && ` — ${receipt.policy.reasons.join("; ")}`}
            </div>
          </div>
          <pre className="overflow-auto rounded-card border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-card border border-border bg-bg p-2.5 text-xs">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(value)}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
      >
        copy
      </button>
    </div>
  );
}
