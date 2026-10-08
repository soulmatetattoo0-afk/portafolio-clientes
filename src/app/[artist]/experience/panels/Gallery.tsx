"use client";

import { useEffect, useMemo, useState } from "react";

import { ArtistCard } from "@/components/world/ArtistCard";
import { fill } from "@/i18n";
import { colorLabel, styleLabel } from "@/lib/catalog";
import type { PortfolioItem } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { PanelHead } from "../Panel";
import type { ExperienceData } from "../types";

/** The wall reads as pages of six; the CSS in globals.css closes every row of a page. */
const PAGE = 6;

type PhoneSlot = "hero" | "square" | "tall" | "wide";
type WideSlot = "hero" | "square" | "column" | "tall" | "wide" | "strip";

/** Two columns: hero on top, two squares, two talls, one wide. A lone tile in a row widens so the row closes. */
function phoneSlot(i: number, n: number): PhoneSlot {
  if (i === 0) return "hero";
  if (i === 5) return "wide";
  if (i <= 2) return n === 2 ? "wide" : "square";
  return n === 4 ? "wide" : "tall";
}

/** Three columns: a square hero over two rows with two squares beside it, then a row of three talls. */
function wideSlot(i: number, n: number): WideSlot {
  if (n === 1) return "strip";
  if (i === 0) return "hero";
  if (i <= 2) return n === 2 ? "column" : "square";
  const last = n - 3;
  if (last === 1) return "strip";
  if (last === 2) return i === 3 ? "wide" : "tall";
  return "tall";
}

/** Deterministic shuffle so a seed gives the same wall on every render. */
function shuffle<T>(list: T[], seed: number) {
  const out = [...list];
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The hero is always a featured piece; a shuffle picks another one and reorders the rest. */
function arrange(items: PortfolioItem[], seed: number) {
  const featured = items.filter((i) => i.featured);
  const hero = featured.length ? featured[seed % featured.length] : items[0];
  if (!hero) return items;
  const rest = items.filter((i) => i !== hero);
  return [hero, ...(seed === 0 ? rest : shuffle(rest, seed))];
}

/** Finished work as a wall: one hero, then a dense collage; or grouped by style with a big header each. */
export function Gallery({ data }: { data: ExperienceData }) {
  const { t, locale, portfolio } = data;
  const a = t.artist;
  const p = a.panel.work;
  const [mode, setMode] = useState<"wall" | "style">("wall");
  const [seed, setSeed] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const styles = useMemo(() => [...new Set(portfolio.map((i) => i.style).filter(Boolean))] as string[], [portfolio]);
  const wall = useMemo(() => arrange(portfolio, seed), [portfolio, seed]);
  const groups = useMemo(() => styles.map((s) => ({ style: s, items: portfolio.filter((i) => i.style === s) })), [styles, portfolio]);
  const flat = mode === "wall" ? wall : groups.flatMap((g) => g.items);

  return (
    <div className="pb-16">
      <PanelHead id="work" kicker={a.deck.cards.work.kicker} title={a.deck.cards.work.title} lead={portfolio.length ? fill(p.count, { n: portfolio.length }) : undefined} />
      {portfolio.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          <div className="seg" role="group">
            <button type="button" aria-pressed={mode === "wall"} onClick={() => setMode("wall")}>
              {p.wall}
            </button>
            {styles.length > 1 && (
              <button type="button" aria-pressed={mode === "style"} onClick={() => setMode("style")}>
                {p.byStyle}
              </button>
            )}
          </div>
          {mode === "wall" && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSeed((s) => s + 1)}>
              ⟳ {p.shuffle}
            </button>
          )}
        </div>
      )}

      {portfolio.length === 0 ? (
        <p className="px-5 text-bone-dim">{p.empty}</p>
      ) : mode === "wall" ? (
        <Wall items={wall} offset={0} page0={0} locale={locale} healed={p.healed} openLabel={p.open} onOpen={setOpen} />
      ) : (
        <div className="grid gap-10">
          {groups.map((g, gi) => {
            const before = groups.slice(0, gi);
            const offset = before.reduce((n, x) => n + x.items.length, 0);
            const page0 = before.reduce((n, x) => n + Math.ceil(x.items.length / PAGE), 0);
            return (
              <section key={g.style} aria-label={styleLabel(g.style, locale)}>
                <div className="flex items-baseline justify-between gap-3 px-5 pb-3">
                  <h3 className="p-display text-[2.6rem] text-bone">{styleLabel(g.style, locale)}</h3>
                  <span className="p-gothic text-[1.2rem] text-accent">{fill(p.count, { n: g.items.length })}</span>
                </div>
                <Wall items={g.items} offset={offset} page0={page0} locale={locale} healed={p.healed} openLabel={p.open} onOpen={setOpen} />
              </section>
            );
          })}
        </div>
      )}
      {data.related.length > 0 && (
        <section className="mt-12 px-5" aria-label={fill(t.world.card.more, { artist: data.artist.display_name.split(" ")[0] })}>
          <p className="p-gothic text-[1.2rem] text-accent">{fill(t.world.card.more, { artist: data.artist.display_name.split(" ")[0] })}</p>
          <ul className="-mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {data.related.slice(0, 6).map((r) => (
              <li key={r.id} className="shrink-0 snap-start">
                <ArtistCard artist={r} locale={locale} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
      {open !== null && flat[open] && <Lightbox items={flat} index={open} locale={locale} close={t.common.close} piece={p.piece} onChange={setOpen} />}
    </div>
  );
}

function Wall({ items, offset, page0, locale, healed, openLabel, onOpen }: { items: PortfolioItem[]; offset: number; page0: number; locale: "en" | "es"; healed: string; openLabel: string; onOpen: (i: number) => void }) {
  const pages: PortfolioItem[][] = [];
  for (let i = 0; i < items.length; i += PAGE) pages.push(items.slice(i, i + PAGE));
  return (
    <div className="grid gap-3 px-3">
      {pages.map((page, pi) => {
        const first = offset + pi * PAGE;
        const flip = (page0 + pi) % 2 === 1;
        return (
          <div key={pi}>
            {pages.length > 1 && (
              <div aria-hidden className="flex items-center gap-3 px-1 pt-2 pb-3">
                <span className="p-gothic text-[1.05rem] text-bone-dim">
                  {String(first + 1).padStart(2, "0")} – {String(first + page.length).padStart(2, "0")}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <ul className={`p-wall ${flip ? "p-wall--flip" : ""}`}>
              {page.map((item, i) => {
                const n = first + i;
                return (
                  <li key={item.id} data-s={phoneSlot(i, page.length)} data-l={wideSlot(i, page.length)}>
                    <Tile item={item} index={n} locale={locale} healed={healed} label={fill(openLabel, { title: item.title ?? "" })} onOpen={() => onOpen(n)} />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** One piece on the wall. A photo that fails to load gives way to the typeset plate so the grid never shows a hole. */
function Tile({ item, index, locale, healed, label, onOpen }: { item: PortfolioItem; index: number; locale: "en" | "es"; healed: string; label: string; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const photo = item.url && !broken;
  return (
    <button type="button" onClick={onOpen} className="group absolute inset-0 block text-left" aria-label={label}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url ?? undefined}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          loading={index < 3 ? "eager" : "lazy"}
          onError={() => setBroken(true)}
          ref={(el) => {
            // A 404 that happened before hydration never fires onError; read the result off the element.
            if (el && el.complete && el.naturalWidth === 0) setBroken(true);
          }}
        />
      ) : (
        <Plate item={item} index={index} variant={index % 3} locale={locale} />
      )}
      {photo && <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/5 to-transparent" />}
      <span aria-hidden className="p-gothic absolute top-2 left-3 text-[1.1rem] leading-none text-bone/90">
        {String(index + 1).padStart(2, "0")}
      </span>
      {item.is_healed && <span className="p-stamp absolute top-2.5 right-2.5 rounded-full bg-ink/75 px-2 py-0.5 text-[0.55rem] text-bone">{healed}</span>}
      {photo && <span className="p-quote absolute right-3 bottom-2 left-3 truncate text-[1.05rem] text-bone">{item.title}</span>}
    </button>
  );
}

function Lightbox({ items, index, locale, close, piece, onChange }: { items: PortfolioItem[]; index: number; locale: "en" | "es"; close: string; piece: string; onChange: (i: number | null) => void }) {
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
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.6rem)]">
        <span className="p-gothic text-[1.2rem] text-bone-dim">
          {piece} {index + 1} / {items.length}
        </span>
        <button type="button" className="btn btn-ghost text-bone" onClick={() => onChange(null)} aria-label={close}>
          <span aria-hidden className="text-[1.4rem]">×</span>
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-4">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.id} src={item.url} alt={item.title ?? ""} className="p-immerse max-h-full max-w-full rounded-[12px] object-contain" />
        ) : (
          <div key={item.id} className="p-immerse relative aspect-[4/5] h-[min(58dvh,520px)] max-w-full overflow-hidden rounded-[14px]">
            <Plate item={item} index={index} variant={index % 3} locale={locale} />
          </div>
        )}
      </div>
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <p className="p-quote text-[1.6rem] text-bone">{item.title}</p>
        <p className="mt-1 text-[0.85rem] text-bone-dim">{[styleLabel(item.style, locale), colorLabel(item.color_mode, locale), placement].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

/** Typeset stand-in for a piece without a photo yet; three treatments so a wall of them still has rhythm. */
export function Plate({ item, index, variant = 0, locale = "en" }: { item: { title: string | null; style?: string | null }; index: number; variant?: number; locale?: "en" | "es" }) {
  const n = String(index + 1).padStart(2, "0");
  if (variant === 1) {
    return (
      <span className="absolute inset-0 flex items-end justify-between overflow-hidden bg-[#161412] p-3">
        <span className="p-halftone" aria-hidden />
        <span className="p-quote relative max-w-[70%] text-[1.2rem] leading-tight text-bone">{item.title}</span>
        <span aria-hidden className="p-display relative text-[3.2rem] leading-none text-accent/80">{n}</span>
      </span>
    );
  }
  if (variant === 2) {
    return (
      <span className="absolute inset-0 grid place-items-center overflow-hidden bg-bone p-3 text-ink">
        <span aria-hidden className="absolute inset-3 rounded-full border-2 border-ink/80" />
        <span aria-hidden className="absolute inset-5 rounded-full border border-dashed border-ink/50" />
        <span className="p-display relative max-w-[80%] text-center text-[1.5rem] leading-[0.95]">{item.title}</span>
        <span aria-hidden className="p-gothic absolute right-3 bottom-2 text-[1.2rem]">{n}</span>
        {item.style && <span className="p-stamp absolute bottom-2 left-3 text-[0.55rem] opacity-70">{styleLabel(item.style, locale)}</span>}
      </span>
    );
  }
  return (
    <span className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-ink-2 p-3">
      <span aria-hidden className="p-display pointer-events-none absolute -top-4 -right-2 text-[7rem] leading-none text-bone/[0.08]">
        {n}
      </span>
      <span className="p-halftone" aria-hidden />
      <span className="p-quote relative text-[1.3rem] leading-tight text-bone">{item.title}</span>
    </span>
  );
}
