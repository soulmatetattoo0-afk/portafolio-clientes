"use client";

import { useState } from "react";

import { Mannequin } from "@/components/Mannequin";
import type { Locale } from "@/i18n";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

/** The landing page's live moment: the same figure clients use, tap to try it. */
export function HeroFigure({ locale, caption }: { locale: Locale; caption: string }) {
  const [zone, setZone] = useState<string | null>(null);
  const label = zone ? PLACEMENT_BY_SLUG.get(zone)?.label[locale] : null;
  return (
    <figure className="relative">
      <div className="relative h-[min(72vh,640px)] min-h-[420px] overflow-hidden rounded-[var(--radius-lg)] border border-line [background:radial-gradient(ellipse_60%_50%_at_50%_28%,#3d3e43,transparent_72%),radial-gradient(ellipse_70%_22%_at_50%_100%,rgb(0_0_0/0.65),transparent_70%),#1c1d20]">
        <Mannequin className="absolute inset-0" body="f" heightCm={167} mode="zone" placement={zone} onZoneTap={setZone} label={caption} />
        <p aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-4 text-center font-serif text-[1.35rem] italic">
          {label}
        </p>
      </div>
      <figcaption className="mt-3 text-[0.85rem] text-ash">{caption}</figcaption>
    </figure>
  );
}

export function Halo() {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute top-[4%] left-1/2 w-[min(58%,300px)] -translate-x-1/2 text-gilt/25" fill="none" stroke="currentColor" strokeWidth="0.8">
      <circle cx="100" cy="100" r="62" />
      <circle cx="100" cy="100" r="70" strokeDasharray="1 5" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r2 = i % 2 ? 84 : 94;
        // Fixed precision: server and browser trig can differ in the last bits.
        const p = (n: number) => n.toFixed(2);
        return <line key={i} x1={p(100 + Math.cos(a) * 76)} y1={p(100 + Math.sin(a) * 76)} x2={p(100 + Math.cos(a) * r2)} y2={p(100 + Math.sin(a) * r2)} />;
      })}
    </svg>
  );
}
