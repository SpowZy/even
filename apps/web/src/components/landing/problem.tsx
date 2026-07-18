"use client";

import { motion } from "motion/react";

const CARDS = [
  {
    role: "CFO",
    title: "Agent spend is a black box",
    body: "One runaway loop can burn a monthly budget before anyone notices. even attributes every cent to an action — and hard-stops at the budget.",
  },
  {
    role: "CTO",
    title: "You can't replay what you can't prove",
    body: "Traces you can re-walk and verify cryptographically. If a single byte changes at rest, the chain tells you exactly where.",
  },
  {
    role: "CISO",
    title: "Auditors don't accept vibes",
    body: "Append-only, tamper-evident evidence with PII scrubbed before it is ever written down. Exportable in one click.",
  },
];

export default function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 font-mono text-xs tracking-[0.2em] text-muted"
      >
        THE PROBLEM
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
      >
        Agents are spending, deciding, and acting — with no receipt.
      </motion.h2>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {CARDS.map((card, i) => (
          <motion.article
            key={card.role}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-card border border-border bg-surface p-6"
          >
            <p className="font-mono text-[11px] tracking-[0.18em] text-primary-soft">{card.role}</p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{card.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
