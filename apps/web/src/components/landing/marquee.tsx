"use client";

import { cn } from "@/lib/format";

interface MarqueeReceipt {
  hash: string;
  tool: string;
  cost: string;
  verdict: "ALLOW" | "REVIEW" | "BLOCK";
}

const RECEIPTS: MarqueeReceipt[] = [
  { hash: "9f2c41aa…", tool: "extract_invoice", cost: "$0.000021", verdict: "ALLOW" },
  { hash: "71bd08e3…", tool: "match_vendor", cost: "$0.000012", verdict: "ALLOW" },
  { hash: "c4a9f102…", tool: "approve_payment_high_value", cost: "$0.000012", verdict: "REVIEW" },
  { hash: "3e77b5d0…", tool: "convert_currency", cost: "$0.000006", verdict: "ALLOW" },
  { hash: "b812ed47…", tool: "send_email", cost: "$0.000000", verdict: "BLOCK" },
  { hash: "05cc39a1…", tool: "approve_payment", cost: "$0.000011", verdict: "ALLOW" },
  { hash: "da60f7c2…", tool: "extract_invoice", cost: "$0.000022", verdict: "ALLOW" },
  { hash: "8834aa19…", tool: "approve_payment", cost: "$0.000011", verdict: "ALLOW" },
];

const CHIP: Record<MarqueeReceipt["verdict"], string> = {
  ALLOW: "border-primary/50 text-primary-soft",
  REVIEW: "border-warn/50 text-warn",
  BLOCK: "border-danger/50 text-danger",
};

export default function Marquee() {
  const track = [...RECEIPTS, ...RECEIPTS];
  return (
    <section aria-label="example receipts" className="border-y border-border bg-surface/40 py-6">
      <div className="marquee-paused overflow-hidden">
        <div className="animate-marquee respect-reduced-motion flex w-max gap-3 pr-3">
          {track.map((r, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-3 rounded-card border border-border bg-bg px-4 py-3 font-mono text-xs"
            >
              <span className="text-muted">{r.hash}</span>
              <span>{r.tool}</span>
              <span className="text-muted">{r.cost}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", CHIP[r.verdict])}>
                {r.verdict}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
