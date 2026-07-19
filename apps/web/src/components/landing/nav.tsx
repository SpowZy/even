"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-border bg-bg/80 backdrop-blur" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="even logo" width={24} height={24} />
          <span className="text-[15px] font-semibold tracking-tight">Even</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <a href="#how" className="transition-colors hover:text-text">
            How it works
          </a>
          <a href="#proof" className="transition-colors hover:text-text">
            Proof
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://github.com/SpowZy/even"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-muted transition-colors hover:text-text sm:block"
          >
            GitHub
          </a>
          <a
            href="/app"
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open live demo
          </a>
        </div>
      </div>
    </header>
  );
}
