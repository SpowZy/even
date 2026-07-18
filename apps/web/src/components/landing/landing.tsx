"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import Lenis from "lenis";
import Nav from "./nav";
import Hero from "./hero";
import Problem from "./problem";
import Marquee from "./marquee";
import HowItWorks from "./how-it-works";
import TerminalTeaser from "./terminal-teaser";
import Footer from "./footer";

export default function Landing() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let raf = 0;
    const loop = (time: number) => {
      lenis?.raf(time);
      raf = requestAnimationFrame(loop);
    };
    const apply = () => {
      if (mq.matches) {
        cancelAnimationFrame(raf);
        lenis?.destroy();
        lenis = null;
      } else if (!lenis) {
        lenis = new Lenis({ duration: 1.1 });
        raf = requestAnimationFrame(loop);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      mq.removeEventListener("change", apply);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="respect-reduced-motion">
        <Nav />
        <Hero />
        <Problem />
        <Marquee />
        <HowItWorks />
        <TerminalTeaser />
        <Footer />
      </div>
    </MotionConfig>
  );
}
