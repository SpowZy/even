"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChainVerification, Receipt, Run } from "@even/core";
import RunRail from "@/components/dashboard/run-rail";
import RunView from "@/components/dashboard/run-view";
import ReceiptsTable from "@/components/dashboard/receipts-table";
import EmptyState from "@/components/dashboard/empty-state";

// Demo deployments use the documented dev token; real deployments set
// EVEN_API_TOKEN server-side and never expose it to the browser.
const AUTH_HEADERS = { Authorization: "Bearer dev-token" };

export default function DashboardPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<"seed" | "tamper" | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const selected = runs?.find((r) => r.id === selectedId) ?? null;

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/runs");
    if (res.ok) setRuns(await res.json());
  }, []);

  const loadRun = useCallback(async (id: string) => {
    setLoadingRun(true);
    try {
      const [detailRes, verifyRes] = await Promise.all([
        fetch(`/api/runs/${id}`),
        fetch(`/api/runs/${id}/verify`),
      ]);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as { run: Run; receipts: Receipt[] };
        setReceipts(detail.receipts);
        setRuns((prev) =>
          prev ? prev.map((r) => (r.id === id ? detail.run : r)) : prev,
        );
      }
      if (verifyRes.ok) setVerification(await verifyRes.json());
    } finally {
      setLoadingRun(false);
    }
  }, []);

  const selectRun = useCallback(
    (id: string) => {
      setSelectedId(id);
      setVerification(null);
      void loadRun(id);
    },
    [loadRun],
  );

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("run", (e) => {
      const run = JSON.parse((e as MessageEvent).data as string) as Run;
      setRuns((prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((r) => r.id === run.id);
        if (idx === -1) return [run, ...list];
        const next = [...list];
        next[idx] = run;
        return next;
      });
    });
    es.addEventListener("receipt", (e) => {
      const receipt = JSON.parse((e as MessageEvent).data as string) as Receipt;
      if (receipt.runId !== selectedRef.current) return;
      setReceipts((prev) =>
        prev.some((r) => r.id === receipt.id) ? prev : [...prev, receipt],
      );
    });
    return () => es.close();
  }, []);

  const seedDemo = useCallback(async () => {
    setBusy("seed");
    try {
      const res = await fetch("/api/demo/seed", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      if (!res.ok) return;
      const { run } = (await res.json()) as { run: Run };
      await loadRuns();
      selectRun(run.id);
    } finally {
      setBusy(null);
    }
  }, [loadRuns, selectRun]);

  const tamper = useCallback(async () => {
    if (!selectedId) return;
    setBusy("tamper");
    try {
      await fetch("/api/demo/tamper", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ runId: selectedId }),
      });
      await loadRun(selectedId);
    } finally {
      setBusy(null);
    }
  }, [selectedId, loadRun]);

  const rever = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/runs/${selectedId}/verify`);
    if (res.ok) setVerification(await res.json());
  }, [selectedId]);

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="even" width={22} height={22} />
            <span className="text-[15px] font-semibold tracking-tight">even</span>
          </a>
          <span className="text-sm text-muted">operations console</span>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                live ? "bg-primary-soft animate-pulse" : "bg-muted"
              }`}
              aria-hidden
            />
            {live ? "live" : "reconnecting"}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        <RunRail
          runs={runs}
          selectedId={selectedId}
          onSelect={selectRun}
          onSeed={seedDemo}
          seeding={busy === "seed"}
        />

        <section className="min-w-0 flex-1">
          {runs === null ? (
            <div className="space-y-3" aria-label="loading">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-card border border-border bg-surface respect-reduced-motion"
                />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <EmptyState onSeed={seedDemo} seeding={busy === "seed"} />
          ) : !selected ? (
            <EmptyState onSeed={seedDemo} seeding={busy === "seed"} pickRun />
          ) : (
            <div className="space-y-6">
              <RunView
                run={selected}
                receipts={receipts}
                verification={verification}
                loading={loadingRun}
                busy={busy}
                onTamper={tamper}
                onReverify={rever}
              />
              <ReceiptsTable
                receipts={receipts}
                brokenAtSeq={verification?.ok === false ? verification.brokenAtSeq : undefined}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
