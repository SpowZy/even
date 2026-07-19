"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Line {
  text: string;
  tone: "cmd" | "ok" | "dim" | "bad";
}

const SCRIPT: Line[] = [
  { text: "$ even verify q3-invoice-ops", tone: "cmd" },
  { text: "✓ 478 receipts · hashes recomputed · signatures valid", tone: "ok" },
  { text: "✓ chain intact · linked from genesis 00000000…", tone: "ok" },
  { text: "> simulating ledger tamper at seq 240", tone: "dim" },
  { text: "✗ seq 240: hash mismatch: content tampered", tone: "bad" },
  { text: "verification failed: 239/478 verified · exit 1", tone: "bad" },
];

const CHAR_MS = 18;
const HOLD_MS = 2600;

const TONE_CLASS: Record<Line["tone"], string> = {
  cmd: "text-text",
  ok: "text-success",
  dim: "text-muted",
  bad: "text-danger",
};

export default function TerminalTeaser() {
  const [progress, setProgress] = useState(0); // total chars typed
  const total = SCRIPT.reduce((s, l) => s + l.text.length + 1, 0);

  useEffect(() => {
    // Subscribe rather than read once: the preference can arrive after
    // mount (emulation, OS setting toggled live) and must apply instantly.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current = 0;

    const tick = () => {
      current += 1;
      setProgress(current);
      if (current >= total) {
        timer = setTimeout(() => {
          current = 0;
          setProgress(0);
          timer = setTimeout(tick, 600);
        }, HOLD_MS);
      } else {
        timer = setTimeout(tick, CHAR_MS);
      }
    };

    const apply = () => {
      if (timer) clearTimeout(timer);
      if (mq.matches) {
        setProgress(total); // fully rendered, no animation
      } else {
        current = 0;
        setProgress(0);
        timer = setTimeout(tick, 700);
      }
    };

    apply();
    mq.addEventListener("change", apply);
    return () => {
      if (timer) clearTimeout(timer);
      mq.removeEventListener("change", apply);
    };
  }, [total]);

  let remaining = progress;
  const rendered = SCRIPT.map((line) => {
    if (remaining <= 0) return { ...line, shown: "" };
    const shown = line.text.slice(0, Math.max(0, remaining - 1));
    remaining -= line.text.length + 1;
    return { ...line, shown };
  });

  return (
    <section id="proof" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted">THE PROOF</p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Break one byte. Watch the chain confess.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted">
            Verification re-walks the entire ledger: sequence, linkage, recomputed
            hashes, signatures. The first broken link is named exactly, with its
            sequence number.
          </p>
          <a
            href="/app"
            className="mt-8 inline-block rounded-card border border-primary/50 px-6 py-3 text-[15px] font-medium text-primary-soft transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Try the tamper demo live
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-card border border-border bg-surface"
        >
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            <span className="ml-3 font-mono text-xs text-muted">even verify</span>
          </div>
          <div
            className="min-h-[220px] p-5 font-mono text-[13px] leading-7"
            aria-live="off"
          >
            {rendered.map((line, i) => (
              <div key={i} className={TONE_CLASS[line.tone]}>
                {line.shown}
                {i === rendered.findIndex((l) => l.shown.length < l.text.length) &&
                  line.shown.length < line.text.length && (
                    <span className="animate-pulse text-primary-soft">▌</span>
                  )}
                {line.shown.length === 0 && line.text.length > 0 && " "}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
