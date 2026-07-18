"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Hero backdrop: drifting receipt-nodes that link into chains. One chain is
 * highlighted in violet — the ledger forming in real time. Hand-rolled 2D
 * canvas, DPR-aware, paused when the tab is hidden, single static frame
 * under prefers-reduced-motion.
 */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.max(40, Math.min(90, Math.floor((w * h) / 16000)));
    const nodes: Node[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
    }));
    // Indices forming the highlighted chain.
    const chain = Array.from({ length: 7 }, (_, i) => Math.floor(((i + 1) * count) / 8));
    const chainSet = new Set(chain);
    const LINK_DIST = 120;

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.12;
            ctx.strokeStyle = `rgba(99,102,241,${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.strokeStyle = "rgba(99,102,241,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      chain.forEach((idx, k) => {
        const n = nodes[idx]!;
        if (k === 0) ctx.moveTo(n.x, n.y);
        else ctx.lineTo(n.x, n.y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;

      for (let i = 0; i < count; i++) {
        const n = nodes[i]!;
        const inChain = chainSet.has(i);
        ctx.fillStyle = inChain ? "rgba(99,102,241,0.9)" : "rgba(139,139,150,0.35)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, inChain ? 2.2 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!mq.matches) raf = requestAnimationFrame(loop);
    };

    // Subscribe rather than read once: a preference arriving after mount
    // stops the loop immediately and leaves a static frame.
    const apply = () => {
      cancelAnimationFrame(raf);
      if (mq.matches) frame();
      else raf = requestAnimationFrame(loop);
    };
    apply();
    document.addEventListener("visibilitychange", onVisibility);
    mq.addEventListener("change", apply);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", apply);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
