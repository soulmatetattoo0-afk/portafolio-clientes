"use client";

import { useEffect, useMemo, useState } from "react";

import { fill } from "@/i18n";
import { colorLabel, styleLabel } from "@/lib/catalog";
import type { PortfolioItem } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { PanelHead } from "../Panel";
import type { ExperienceData } from "../types";

/** Finished work: an editorial two-column wall; tap a piece to see it alone. */
export function Gallery({ data }: { data: ExperienceData }) {
  const { t, locale, portfolio } = data;
  const a = t.artist;
  const p = a.panel.work;
  const styles = useMemo(() => [...new Set(portfolio.map((i) => i.style).filter(Boolean))] as string[], [portfolio]);
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const shown = filter ? portfolio.filter((i) => i.style === filter) : portfolio;

  return (
    <div className="pb-16">
      <PanelHead id="work" kicker={a.deck.cards.work.kicker} title={a.deck.cards.work.title} lead={portfolio.length ? fill(p.count, { n: portfolio.length }) : undefined} />
      {styles.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none]" role="group">
          <button type="button" className="chip shrink-0" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            {p.all}
          </button>
          {styles.map((s) => (
            <button key={s} type="button" className="chip shrink-0" aria-pressed={filter === s} onClick={() => setFilter(s)}>
              {styleLabel(s, locale)}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-5 text-bone-dim">{p.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4">
          {shown.map((item, i) => (
            <li key={item.id} className={i % 2 === 1 ? "mt-10" : ""}>
              <button type="button" onClick={() => setOpen(i)} className="group block w-full text-left" aria-label={fill(p.open, { title: item.title ?? "" })}>
                <span className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-ink-2">
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <Plate item={item} index={i} />
                  )}
                  {item.is_healed && <span className="p-stamp absolute top-2 left-2 rounded-full bg-ink/80 px-2 py-1 text-[0.58rem] text-bone">{p.healed}</span>}
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="p-stamp whitespace-nowrap text-bone-dim">№ {String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate text-[0.82rem] text-bone/80">{item.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open !== null && shown[open] && <Lightbox items={shown} index={open} locale={locale} close={t.common.close} onChange={setOpen} />}
    </div>
  );
}

function Lightbox({ items, index, locale, close, onChange }: { items: PortfolioItem[]; index: number; locale: "en" | "es"; close: string; onChange: (i: number | null) => void }) {
  const item = items[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      if (e.key === "ArrowRight") onChange(Math.min(items.length - 1, index + 1));
      if (e.key === "ArrowLeft") onChange(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onChange]);
  const [x0, setX0] = useState<number | null>(null);
  const placement = item.placement ? PLACEMENT_BY_SLUG.get(item.placement)?.label[locale] : null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title ?? ""}
      className="p-sheet fixed inset-0 z-40 flex flex-col bg-ink/97 backdrop-blur-sm"
      onPointerDown={(e) => setX0(e.clientX)}
      onPointerUp={(e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        if (dx < -50) onChange(Math.min(items.length - 1, index + 1));
        else if (dx > 50) onChange(Math.max(0, index - 1));
        setX0(null);
      }}
    >
      <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.6rem)]">
        <span className="p-stamp text-bone-dim">
          {index + 1} / {items.length}
        </span>
        <button type="button" className="btn btn-ghost text-bone" onClick={() => onChange(null)} aria-label={close}>
          <span aria-hidden className="text-[1.4rem]">×</span>
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-4">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title ?? ""} className="max-h-full max-w-full rounded-[12px] object-contain" />
        ) : (
          <div className="relative aspect-[4/5] h-[min(60dvh,520px)] max-w-full overflow-hidden rounded-[14px]">
            <Plate item={item} index={index} />
          </div>
        )}
      </div>
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <p className="p-quote text-[1.4rem] text-bone">{item.title}</p>
        <p className="mt-1 text-[0.85rem] text-bone-dim">{[styleLabel(item.style, locale), colorLabel(item.color_mode, locale), placement].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

/** Typeset stand-in for a piece without a photo yet. */
export function Plate({ item, index }: { item: { title: string | null; style?: string | null }; index: number }) {
  return (
    <span className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-ink-2 p-3">
      <span aria-hidden className="p-display pointer-events-none absolute -top-3 -right-2 text-[6.5rem] leading-none text-bone/[0.07]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="p-halftone" aria-hidden />
      <span className="p-quote relative text-[1.15rem] leading-tight text-bone">{item.title}</span>
    </span>
  );
}
