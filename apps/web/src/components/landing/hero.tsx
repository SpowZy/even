"use client";

import { motion } from "motion/react";
import HeroCanvas from "./hero-canvas";

const HEADLINE = ["every", "agent", "action,", "accounted", "for."];

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <HeroCanvas />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 font-mono text-xs tracking-[0.2em] text-muted"
        >
          EVEN — RECEIPT LAYER FOR AI AGENTS
        </motion.p>

        <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-7xl md:text-8xl">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={word + i}
              className="inline-block"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}
              {i < HEADLINE.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-muted"
        >
          Signed, hash-chained receipts for every tool call and LLM call.
          Per-action cost, policy verdicts, and proof your auditors can check —
          not logs you have to trust.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="/app"
            className="rounded-card bg-primary px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open live demo
          </a>
          <a
            href="#how"
            className="rounded-card border border-border px-6 py-3 text-[15px] font-medium text-text transition-colors hover:border-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            How it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="mt-16 flex items-center gap-2 font-mono text-xs text-muted"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-soft" />
          sha256 · ed25519 · append-only · tamper-evident
        </motion.div>
      </div>
    </section>
  );
}
