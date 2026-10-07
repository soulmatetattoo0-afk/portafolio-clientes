"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LangToggle } from "@/components/LangToggle";
import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

import { PANELS, type ExperienceData, type PanelId } from "./types";

/**
 * The deck: five cards on a horizontal rail you flick with a thumb. The centre
 * card stands up; the others lean away. Tapping the centre card opens its panel
 * from the card's own rectangle (the rect is handed up for the clip animation).
 */
export function Deck({ data, initial, onOpen }: { data: ExperienceData; initial: PanelId; onOpen: (id: PanelId, from: DOMRect) => void }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(PANELS.indexOf(initial));
  const dragging = useRef(false);

  const layout = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    cards.current.forEach((c, i) => {
      if (!c) return;
      const center = c.offsetLeft + c.offsetWidth / 2;
      const d = (center - mid) / c.offsetWidth;
      const ad = Math.min(Math.abs(d), 1.6);
      c.style.transform = `perspective(1100px) rotateY(${(-d * 16).toFixed(2)}deg) scale(${(1 - ad * 0.1).toFixed(3)}) translateZ(${(-ad * 40).toFixed(1)}px)`;
      c.style.opacity = String(1 - ad * 0.28);
      c.style.zIndex = String(10 - Math.round(ad * 4));
      if (Math.abs(d) < bestD) {
        bestD = Math.abs(d);
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(layout);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    // Land on the requested card without animation, then lay out.
    const target = cards.current[PANELS.indexOf(initial)];
    if (target) el.scrollLeft = target.offsetLeft + target.offsetWidth / 2 - el.clientWidth / 2;
    layout();
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", layout);
    };
  }, [layout, initial]);

  const scrollTo = (i: number) => {
    const el = rail.current;
    const c = cards.current[i];
    if (!el || !c) return;
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: "smooth" });
  };

  const tap = (i: number) => {
    if (i !== active) return scrollTo(i);
    const c = cards.current[i];
    if (c) onOpen(PANELS[i], c.getBoundingClientRect());
  };

  // Keyboard: arrows move, Enter opens.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") scrollTo(Math.min(PANELS.length - 1, active + 1));
    else if (e.key === "ArrowLeft") scrollTo(Math.max(0, active - 1));
  };

  const cover = artist.portrait_url;
  const firstWork = data.portfolio.find((p) => p.url)?.url ?? null;
  const firstFlash = data.flash.find((f) => f.url)?.url ?? null;
  const openCount = data.flash.filter((f) => f.status === "available").length;

  return (
    <div className="p-immerse relative flex h-dvh flex-col overflow-hidden">
      <div className="p-grain" aria-hidden />
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),0.9rem)]">
        <span className="p-stamp text-bone">{artist.display_name.toUpperCase()}</span>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>

      <p className="p-stamp mt-5 px-5 text-bone-dim">{a.deck.hint}</p>

      <div
        ref={rail}
        className="p-rail mt-3 flex-1 items-center gap-4 px-[calc(50vw-min(35vw,160px))] py-4 sm:gap-6"
        role="listbox"
        aria-label={a.deck.menu}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={() => {
          dragging.current = true;
          rail.current?.classList.add("is-dragging");
        }}
        onPointerUp={() => {
          dragging.current = false;
          rail.current?.classList.remove("is-dragging");
        }}
      >
        {PANELS.map((id, i) => {
          const c = a.deck.cards[id];
          const tone = TONES[id];
          return (
            <button
              key={id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={i === active}
              onClick={() => tap(i)}
              className={`p-card relative flex aspect-[3/4.3] w-[min(70vw,320px)] flex-col justify-between overflow-hidden rounded-[22px] border p-5 text-left shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] ${tone}`}
            >
              {id === "bio" && cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-80 grayscale" />
              )}
              {id === "work" && !firstWork && <Numeral n={data.portfolio.length} />}
              {id === "flash" && !firstFlash && <Numeral n={openCount} />}
              {id === "work" && firstWork && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstWork} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
              )}
              {id === "flash" && firstFlash && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstFlash} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-multiply" />
              )}
              {id === "book" && <FigureMark />}
              {id === "spots" && (
                <div aria-hidden className="absolute inset-x-0 top-14 overflow-hidden">
                  {data.stops.slice(0, 4).map((s) => (
                    <p key={s.id} className="p-display truncate px-5 text-[2.6rem] leading-[0.95] opacity-25">
                      {s.city}
                    </p>
                  ))}
                </div>
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="p-stamp relative opacity-80">{c.kicker}</span>
              <span className="relative">
                <span className="p-display block text-[2.4rem]">{c.title}</span>
                <span className="mt-2 block text-[0.9rem] opacity-85">{c.body}</span>
                <span className="mt-3 block text-[0.78rem] opacity-70">
                  {id === "work" && data.portfolio.length ? fill(a.panel.work.count, { n: data.portfolio.length }) : null}
                  {id === "flash" && data.flash.length ? `${openCount} ${a.panel.flash.available.toLowerCase()}` : null}
                  {id === "spots" && data.stops[1] ? `${data.stops[1].city} · ${dateRange(data.stops[1].starts_on, data.stops[1].ends_on, locale)}` : null}
                  {id === "book" ? (artist.accepting ? a.booksOpen : a.booksClosed) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2" aria-hidden>
        {PANELS.map((id, i) => (
          <span key={id} className={`h-[3px] rounded-full transition-all ${i === active ? "w-7 bg-bone" : "w-3 bg-bone/30"}`} />
        ))}
      </div>
    </div>
  );
}

/* Each card wears its own paper. */
const TONES: Record<PanelId, string> = {
  bio: "border-bone/20 bg-ink-2 text-bone",
  work: "border-bone/20 bg-[#1c1a18] text-bone",
  flash: "border-black/20 bg-accent text-ink",
  book: "border-black/10 bg-bone text-ink",
  spots: "border-bone/20 bg-[#121a16] text-bone",
};

/** A count set huge and faint, for cards that have no photo yet. */
function Numeral({ n }: { n: number }) {
  return (
    <span aria-hidden className="p-display pointer-events-none absolute -top-6 -right-3 text-[11rem] leading-none opacity-[0.12]">
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** A quiet figure outline for the booking card. */
function FigureMark() {
  return (
    <svg aria-hidden viewBox="0 0 100 160" className="absolute top-1/2 right-4 h-[64%] -translate-y-1/2 text-ink/70" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="50" cy="18" rx="10" ry="13" />
      <path d="M38 33c-14 3-20 10-21 24l-4 36 8 1 5-30 2 28-3 50h10l7-44 7 44h10l-3-50 2-28 5 30 8-1-4-36c-1-14-7-21-21-24" />
      <circle cx="31" cy="84" r="7" className="text-accent" stroke="currentColor" strokeWidth="2" />
      <circle cx="31" cy="84" r="2" className="text-accent" fill="currentColor" />
    </svg>
  );
}
