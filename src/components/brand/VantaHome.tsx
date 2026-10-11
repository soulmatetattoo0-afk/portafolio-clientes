"use client";

import gsap from "gsap";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { VantaMark, VantaWord } from "./VantaLogo";

/**
 * The way back to VANTA from inside an artist's world: the logo, still, that
 * gives a small hop every few seconds so it reads as something to press.
 */
export function VantaHome({ label, className = "" }: { label: string; className?: string }) {
  const el = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!el.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tl = gsap
      .timeline({ repeat: -1, repeatDelay: 4.5, delay: 2.5 })
      .to(el.current, { y: -7, scaleY: 1.04, duration: 0.16, ease: "power2.out" })
      .to(el.current, { y: 0, scaleY: 1, duration: 0.55, ease: "bounce.out" });
    return () => {
      tl.kill();
    };
  }, []);
  return (
    <Link
      ref={el}
      href="/"
      aria-label={label}
      className={`flex origin-bottom items-center gap-2 rounded-full border border-bone/25 bg-ink-2/70 px-4 py-2 text-bone shadow-[0_10px_24px_-10px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur transition-colors hover:border-bone/60 active:scale-95 ${className}`}
    >
      <VantaMark className="h-5 w-auto" />
      <VantaWord className="h-[0.5rem] w-auto" />
    </Link>
  );
}
