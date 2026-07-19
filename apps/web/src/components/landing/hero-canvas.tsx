"use client";

import { useEffect, useRef } from "react";

interface Pulse {
  curve: number;
  s: number; // 0..1 position along the curve
  speed: number;
}

/**
 * Hero backdrop: slow luminous currents flowing left to right, with bright
 * pulses traveling along them like receipts moving through the ledger.
 * Hand-rolled 2D canvas, DPR-aware, paused when hidden, one static frame
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
    const CURVES = 11;
    const PULSES = 26;
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pulses: Pulse[] = Array.from({ length: PULSES }, () => ({
      curve: Math.floor(Math.random() * CURVES),
      s: Math.random(),
      speed: 0.0006 + Math.random() * 0.0011,
    }));

    // Vertical position of curve i at horizontal fraction u, time t.
    // Two layered sines read as a slow organic current, not a wave machine.
    const curveY = (i: number, u: number, time: number): number => {
      const base = ((i + 0.5) / CURVES) * h;
      return (
        base +
        Math.sin(u * 4.2 + time * 0.32 + i * 1.7) * (h * 0.045) +
        Math.sin(u * 9.1 - time * 0.21 + i * 0.9) * (h * 0.02)
      );
    };

    const drawCurve = (i: number) => {
      ctx.beginPath();
      const steps = 48;
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const x = u * (w + 80) - 40;
        const y = curveY(i, u, t);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(99,102,241,0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawPulse = (p: Pulse) => {
      const u = p.s;
      const x = u * (w + 80) - 40;
      const y = curveY(p.curve, u, t);

      // Fading trail behind the pulse.
      const trail = 0.035;
      const grad = ctx.createLinearGradient(
        (u - trail) * (w + 80) - 40,
        y,
        x,
        y,
      );
      grad.addColorStop(0, "rgba(99,102,241,0)");
      grad.addColorStop(1, "rgba(129,140,248,0.55)");
      ctx.beginPath();
      const trailSteps = 8;
      for (let k = 0; k <= trailSteps; k++) {
        const uu = Math.max(0, u - trail + (trail * k) / trailSteps);
        const xx = uu * (w + 80) - 40;
        const yy = curveY(p.curve, uu, t);
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = "rgba(165,180,252,0.95)";
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < CURVES; i++) drawCurve(i);
      for (const p of pulses) drawPulse(p);
    };

    const loop = () => {
      t += 0.016;
      for (const p of pulses) {
        p.s += p.speed;
        if (p.s > 1.05) {
          p.s = -0.05;
          p.curve = Math.floor(Math.random() * CURVES);
        }
      }
      frame();
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!mq.matches) raf = requestAnimationFrame(loop);
    };

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
