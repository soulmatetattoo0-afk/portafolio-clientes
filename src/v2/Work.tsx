"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fill, type Dict, type Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { PortfolioItem, PortfolioSection } from "@/lib/queries";

import { Ring } from "./Ring";

export interface Group {
  id: string;
  name: string;
  cover: PortfolioItem;
  items: PortfolioItem[];
}

/** The artist's sections when they made them; otherwise one group per style the pieces carry. */
export function groupPieces(pieces: PortfolioItem[], sections: PortfolioSection[], locale: Locale, more: string): Group[] {
  const out: Group[] = [];
  if (sections.length) {
    for (const s of sections) {
      const items = pieces.filter((i) => i.section_id === s.id);
      if (items.length) out.push({ id: s.id, name: s.name, items, cover: items.find((i) => i.id === s.cover_item_id) ?? items[0] });
    }
    const rest = pieces.filter((i) => !i.section_id || !sections.some((s) => s.id === i.section_id));
    if (rest.length) out.push({ id: "rest", name: more, items: rest, cover: rest[0] });
  } else {
    for (const st of [...new Set(pieces.map((i) => i.style).filter((x): x is string => !!x))]) {
      const items = pieces.filter((i) => i.style === st);
      out.push({ id: st, name: styleLabel(st, locale), items, cover: items.find((i) => i.featured) ?? items[0] });
    }
    const rest = pieces.filter((i) => !i.style);
    if (rest.length) out.push({ id: "rest", name: more, items: rest, cover: rest[0] });
  }
  return out;
}

/** A piece inside a window, where the artist framed it (centre and closeness); the same framing serves the grid and the viewer. */
export function Framed({ item, className = "", sizes }: { item: Pick<PortfolioItem, "url" | "focus_x" | "focus_y" | "zoom" | "title">; className?: string; sizes?: string }) {
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url!}
        alt={item.title ?? ""}
        loading="lazy"
        sizes={sizes}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: `${item.focus_x}% ${item.focus_y}%`, transform: item.zoom !== 1 ? `scale(${item.zoom})` : undefined, transformOrigin: `${item.focus_x}% ${item.focus_y}%` }}
      />
    </span>
  );
}

/**
 * Obras: the styles as cards on a ring the thumb turns, the style's name
 * under the card in front; a style opens its gallery; any piece opens across
 * the phone in its 4:5 window, swiping to the next. The owner's copy carries
 * the button that edits the section.
 */
export function Work({ pieces, sections, locale, t, back, editHref }: { pieces: PortfolioItem[]; sections: PortfolioSection[]; locale: Locale; t: Dict; back: string; editHref: string | null }) {
  const w = t.v2.work;
  const groups = useMemo(() => groupPieces(pieces, sections, locale, w.more), [pieces, sections, locale, w.more]);
  const [group, setGroup] = useState<Group | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<{ items: PortfolioItem[]; start: number } | null>(null);
  const shown = group ? group.items : pieces;

  return (
    <div className="poster v2-page min-h-dvh">
      <header className="v2-top">
        <Link href={group || all ? "#" : back} onClick={group || all ? (e) => (e.preventDefault(), setGroup(null), setAll(false)) : undefined} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 truncate text-[1.6rem] uppercase leading-none">{group ? group.name : w.title}</h1>
        {!group && pieces.length > 0 && (
          <button type="button" onClick={() => setAll((v) => !v)} aria-pressed={all} className="rounded-full border border-bone/25 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-bone aria-pressed:bg-bone aria-pressed:text-ink">
            {w.all}
          </button>
        )}
      </header>

      {pieces.length === 0 ? (
        <p className="px-5 pt-6 text-bone-dim">{w.empty}</p>
      ) : group || all ? (
        <ul className="grid grid-cols-2 gap-2 px-3 pt-3">
          {shown.map((item, i) => (
            <li key={item.id}>
              <button type="button" onClick={() => setOpen({ items: shown, start: i })} className="block w-full overflow-hidden rounded-[18px] bg-ink-2 text-left">
                <Framed item={item} className="aspect-[4/5] w-full" sizes="50vw" />
                {item.title && <span className="block truncate px-2.5 py-2 text-[0.82rem] text-bone/85">{item.title}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-3 pt-[clamp(0.5rem,4vh,2.5rem)]">
          <Ring
            items={groups}
            onOpen={(g) => setGroup(g)}
            render={(g, front) => (
              <span className={`ed-tile block aspect-[4/5] w-full ${front ? "ring-1 ring-bone/40" : ""}`}>
                <Framed item={g.cover} className="absolute inset-0 h-full w-full" sizes="62vw" />
                <span className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgb(10 10 10 / 0.55) 0%, transparent 45%)" }} />
                <span className="absolute left-3 top-3 flex items-center gap-2 text-[0.62rem] tracking-[0.12em] text-bone/85">
                  {String(groups.indexOf(g) + 1).padStart(2, "0")}
                  <span className="h-px w-6 bg-bone/70" />
                </span>
              </span>
            )}
            label={(g) => (
              <span className="block">
                <span className="p-display block text-[2.4rem] uppercase leading-[0.88] text-bone">{g.name}</span>
                <span className="mt-1.5 block text-[0.6rem] font-medium uppercase tracking-[0.3em] text-bone/70">{fill(w.pieces, { n: g.items.length })} · {w.openStyle}</span>
              </span>
            )}
          />
          {groups.length > 1 && <p className="mt-3 text-center text-[0.78rem] text-bone-dim">{w.swipe}</p>}
        </div>
      )}

      {editHref && (
        <Link href={editHref} className="v2-fab" data-tone="accent">
          <Pencil /> {t.v2.edit.work}
        </Link>
      )}
      {open && <Viewer items={open.items} start={open.start} onClose={() => setOpen(null)} closeLabel={t.common.close} />}
    </div>
  );
}

export function Pencil() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.05em] w-[1.05em]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

/** One piece across the phone, in its 4:5 window; swipe for the next. Words, when the artist wrote them, sit under it. */
function Viewer({ items, start, onClose, closeLabel }: { items: PortfolioItem[]; start: number; onClose: () => void; closeLabel: string }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!el) return;
      if (e.key === "ArrowRight") el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
      if (e.key === "ArrowLeft") el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [start, onClose]);
  return createPortal(
    <div className="poster fixed inset-0 z-[70] bg-ink text-bone" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-[1.4rem]" aria-label={closeLabel}>
        ×
      </button>
      <div ref={track} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {items.map((it) => (
          <figure key={it.id} className="flex h-full w-full shrink-0 snap-center flex-col justify-center px-3 pt-14 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <Framed item={it} className="mx-auto aspect-[4/5] w-full max-w-[min(100%,calc((100svh-9rem)*0.8))] rounded-[14px]" sizes="100vw" />
            {(it.title || it.story) && (
              <figcaption className="mx-auto mt-4 w-full max-w-[420px] px-1">
                {it.title && <p className="p-display text-[1.6rem] uppercase leading-none">{it.title}</p>}
                {it.story && <p className="mt-2 font-serif text-[1.05rem] leading-relaxed text-bone/85">{it.story}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  );
}
