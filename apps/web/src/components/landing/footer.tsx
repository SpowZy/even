"use client";

import { motion } from "motion/react";

const STATS = [
  { value: "200", label: "invoices processed" },
  { value: "478", label: "receipts chained" },
  { value: "1", label: "injection blocked" },
  { value: "~2 ms", label: "per signed receipt" },
];

export default function Footer() {
  return (
    <>
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-14 sm:grid-cols-4 sm:px-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="font-mono text-3xl font-medium tracking-tight text-text sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1.5 text-xs text-muted">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-32 text-center sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-6xl"
        >
          Stop trusting. Start verifying.
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10"
        >
          <a
            href="/app"
            className="inline-block rounded-card bg-primary px-8 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open live demo
          </a>
        </motion.div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={16} height={16} />
            <span>Even. Every agent action, accounted for.</span>
          </div>
          <span>MIT · 2026</span>
        </div>
      </footer>
    </>
  );
}
