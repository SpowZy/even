"use client";

import { motion } from "motion/react";

const STEPS = [
  {
    title: "Wrap",
    body: "One function around your agent. Any framework, any model, five lines of code.",
    icon: (
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2M7.8 16.2l-2.2 2.2" />
    ),
  },
  {
    title: "Sign",
    body: "Every action becomes an ed25519-signed receipt, hash-chained to the one before it.",
    icon: (
      <>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M9 11h6M9 15h6M9 7h2" />
      </>
    ),
  },
  {
    title: "Enforce",
    body: "Budgets, blocked tools and PII redaction execute before the tool ever runs.",
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Verify",
    body: "Anyone can re-walk the chain. Tampering localizes to the exact broken link.",
    icon: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 font-mono text-xs tracking-[0.2em] text-muted"
      >
        HOW IT WORKS
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
      >
        From tool call to proof in four steps.
      </motion.h2>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <motion.article
            key={step.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            className="group rounded-card border border-border bg-surface p-6 transition-colors hover:border-primary/40"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-card border border-border bg-bg text-primary-soft transition-colors group-hover:border-primary/40">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {step.icon}
              </svg>
            </div>
            <p className="font-mono text-[11px] text-muted">0{i + 1}</p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
