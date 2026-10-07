"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import type { Locale } from "@/i18n";
import { colorLabel, styleLabel } from "@/lib/catalog";
import type { PortfolioItem } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

export function PortfolioGrid({ items, locale, labels }: { items: PortfolioItem[]; locale: Locale; labels: { all: string; healed: string; empty: string } }) {
  const styles = useMemo(() => [...new Set(items.map((i) => i.style).filter(Boolean))] as string[], [items]);
  const [filter, setFilter] = useState<string | null>(null);
  const shown = filter ? items.filter((i) => i.style === filter) : items;

  if (!items.length) return <p className="text-ash">{labels.empty}</p>;
  return (
    <div className="grid gap-5">
      {styles.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group">
          <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            {labels.all}
          </button>
          {styles.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
              {styleLabel(s, locale)}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.id} className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] bg-niche">
            {item.url ? (
              <Image src={item.url} alt={item.title ?? ""} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
            ) : (
              <Plate item={item} locale={locale} />
            )}
            {item.is_healed && (
              <span className="absolute top-2 left-2 rounded-full bg-soot/80 px-2 py-0.5 text-[0.72rem] font-semibold text-verdigris backdrop-blur-sm">{labels.healed}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Typeset stand-in for entries without a photo yet (the demo artist has none). */
function Plate({ item, locale }: { item: PortfolioItem; locale: Locale }) {
  const placement = item.placement ? PLACEMENT_BY_SLUG.get(item.placement)?.label[locale] : null;
  return (
    <div className="absolute inset-0 flex flex-col justify-end border border-line p-4 [background:radial-gradient(ellipse_70%_55%_at_50%_38%,color-mix(in_oklab,var(--color-gilt)_14%,transparent),transparent_70%),var(--color-niche)]">
      <svg aria-hidden viewBox="0 0 100 100" className="absolute top-[14%] left-1/2 w-[46%] -translate-x-1/2 text-gilt/45" fill="none" stroke="currentColor" strokeWidth="0.6">
        <circle cx="50" cy="50" r="30" />
        <circle cx="50" cy="50" r="36" strokeDasharray="0.8 3.2" />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const r2 = i % 2 ? 42 : 47;
          const p = (n: number) => n.toFixed(2);
          return <line key={i} x1={p(50 + Math.cos(a) * 39)} y1={p(50 + Math.sin(a) * 39)} x2={p(50 + Math.cos(a) * r2)} y2={p(50 + Math.sin(a) * r2)} />;
        })}
      </svg>
      <p className="font-serif text-[1.15rem] leading-tight italic sm:text-[1.3rem]">{item.title}</p>
      <p className="mt-1 text-[0.78rem] text-ash">
        {[styleLabel(item.style, locale), colorLabel(item.color_mode, locale), placement].filter(Boolean).join(", ")}
      </p>
    </div>
  );
}
