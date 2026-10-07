"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LangToggle } from "@/components/LangToggle";
import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

import { PANELS, type ExperienceData, type PanelId } from "./types";

const N = PANELS.length;
/** Signed distance of card i from the front, in card steps, wrapped onto (-N/2, N/2]. */
const dist = (i: number, angle: number) => ((((i - angle) % N) + N + N / 2) % N) - N / 2;

/**
 * The deck: all five cards stand on a ring. The front card faces you, the
 * others curve away on both sides; drag with a thumb and the ring turns, the
 * card leaving on the left comes back round on the right. Tap the front card
 * and it comes forward while the rest fall away, then its panel opens.
 */
export function Deck({ data, initial, onOpen }: { data: ExperienceData; initial: PanelId; onOpen: (id: PanelId, from: DOMRect) => void }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [angle, setAngle] = useState(PANELS.indexOf(initial));
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const drag = useRef({ x0: 0, a0: 0, moved: false, lastX: 0, lastT: 0, v: 0, hit: -1 });
  const active = ((Math.round(angle) % N) + N) % N;

  const step = () => Math.max(160, Math.min(stage.current?.clientWidth ?? 320, 520) * 0.62);

  const onPointerDown = (e: React.PointerEvent) => {
    if (opening !== null) return;
    // Remember which card the finger landed on: with the pointer captured by the stage, the click never reaches the card.
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
    drag.current = { x0: e.clientX, a0: angle, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0, hit: hit ? Number(hit.dataset.card) : -1 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const d = drag.current;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 6) d.moved = true;
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    setAngle(d.a0 - dx / step());
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const d = drag.current;
    if (!d.moved) {
      if (d.hit >= 0) tap(d.hit);
      return;
    }
    // Fling: a quick swipe carries the ring one more card.
    const fling = Math.abs(d.v) > 0.6 ? -Math.sign(d.v) : 0;
    setAngle(Math.round(angle + fling));
  };

  const turnTo = (i: number) => {
    // Shortest way round the ring.
    setAngle(angle + dist(i, angle));
  };

  const open = useCallback(
    (i: number) => {
      const c = cards.current[i];
      if (!c) return;
      const rect = c.getBoundingClientRect();
      setOpening(i);
      setTimeout(() => onOpen(PANELS[i], rect), 420);
    },
    [onOpen],
  );

  const tap = (i: number) => {
    if (i !== active) turnTo(i);
    else open(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setAngle((v) => Math.round(v) + 1);
      else if (e.key === "ArrowLeft") setAngle((v) => Math.round(v) - 1);
      else if (e.key === "Enter") open(active);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, open]);

  const cover = artist.portrait_url;
  const firstWork = data.portfolio.find((p) => p.url)?.url ?? null;
  const firstFlash = data.flash.find((f) => f.url)?.url ?? null;
  const openCount = data.flash.filter((f) => f.status === "available").length;
  const front = a.deck.cards[PANELS[active]];

  return (
    <div className="p-immerse relative flex h-dvh flex-col overflow-hidden">
      <div className="p-grain" aria-hidden />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),0.9rem)]">
        <span className="p-stamp text-bone">{artist.display_name.toUpperCase()}</span>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>

      <div
        ref={stage}
        className={`p-ring relative min-h-0 flex-1 ${dragging ? "is-dragging" : ""} ${opening !== null ? "is-opening" : ""}`}
        role="listbox"
        aria-label={a.deck.menu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {PANELS.map((id, i) => {
          const c = a.deck.cards[id];
          const d = dist(i, angle);
          const ad = Math.abs(d);
          const isOpening = opening === i;
          const transform = isOpening
            ? "translate(-50%, -50%) translateZ(340px) scale(1.12)"
            : `translate(-50%, -50%) translateX(${(d * 62).toFixed(2)}%) translateZ(${(-ad * 150).toFixed(1)}px) rotateY(${(-d * 20).toFixed(2)}deg) scale(${(1 - ad * 0.08).toFixed(3)})`;
          const opacity = opening !== null && !isOpening ? 0 : Math.max(0.3, 1 - ad * 0.22);
          return (
            <button
              key={id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={i === active}
              data-card={i}
              onClick={(e) => {
                // Pointer taps are handled on the stage; this is for the keyboard.
                if (e.detail === 0) tap(i);
              }}
              style={{ transform, opacity, zIndex: 100 - Math.round(ad * 10) }}
              className={`p-ring-card flex aspect-[3/4.4] w-[min(62vw,300px)] flex-col justify-between overflow-hidden rounded-[20px] border p-4 text-left shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] ${TONES[id]}`}
            >
              {id === "bio" && cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-85 grayscale" draggable={false} />
              )}
              {id === "work" && (firstWork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstWork} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" draggable={false} />
              ) : (
                <Numeral n={data.portfolio.length} />
              ))}
              {id === "flash" && (firstFlash ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstFlash} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-multiply" draggable={false} />
              ) : (
                <Numeral n={openCount} />
              ))}
              {id === "book" && <FigureMark />}
              {id === "spots" && (
                <div aria-hidden className="absolute inset-x-0 top-12 overflow-hidden">
                  {data.stops.slice(0, 4).map((s) => (
                    <p key={s.id} className="p-display truncate px-4 text-[2.4rem] leading-[0.95] opacity-20">
                      {s.city}
                    </p>
                  ))}
                </div>
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="p-gothic relative text-[1.15rem] opacity-90">{c.kicker}</span>
              <span className="relative">
                <span className="p-display block text-[2.1rem]">{c.title}</span>
                <span className="mt-1 block text-[0.82rem] opacity-80">{c.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* The front card, named below the ring, like the track under a player. */}
      <div className="relative z-10 grid gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.1rem)] text-center">
        <div className="flex items-center justify-center gap-2" aria-hidden>
          {PANELS.map((id, i) => (
            <span key={id} className={`h-[3px] rounded-full transition-all ${i === active ? "w-7 bg-accent" : "w-3 bg-bone/25"}`} />
          ))}
        </div>
        <p className="p-stamp text-bone-dim">{a.deck.hint}</p>
        <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-ink-2/80 py-2 pr-2 pl-5 backdrop-blur">
          <div className="min-w-0 text-left">
            <p className="p-display truncate text-[1.25rem]">{front.title}</p>
            <p className="truncate text-[0.78rem] text-bone-dim">
              {PANELS[active] === "work" && data.portfolio.length ? fill(a.panel.work.count, { n: data.portfolio.length }) : null}
              {PANELS[active] === "flash" && data.flash.length ? `${openCount} ${a.panel.flash.available.toLowerCase()}` : null}
              {PANELS[active] === "spots" && data.stops[1] ? `${data.stops[1].city} · ${dateRange(data.stops[1].starts_on, data.stops[1].ends_on, locale)}` : null}
              {PANELS[active] === "book" ? (artist.accepting ? a.booksOpen : a.booksClosed) : null}
              {PANELS[active] === "bio" ? front.body : null}
            </p>
          </div>
          <button type="button" className="btn btn-accent shrink-0" onClick={() => open(active)}>
            {a.deck.enter}
          </button>
        </div>
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
    <span aria-hidden className="p-gothic pointer-events-none absolute -top-2 -right-1 text-[9rem] leading-none opacity-[0.14]">
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** A quiet figure outline for the booking card. */
function FigureMark() {
  return (
    <svg aria-hidden viewBox="0 0 100 160" className="absolute top-1/2 right-3 h-[62%] -translate-y-1/2 text-ink/70" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="50" cy="18" rx="10" ry="13" />
      <path d="M38 33c-14 3-20 10-21 24l-4 36 8 1 5-30 2 28-3 50h10l7-44 7 44h10l-3-50 2-28 5 30 8-1-4-36c-1-14-7-21-21-24" />
      <circle cx="31" cy="84" r="7" className="text-accent" stroke="currentColor" strokeWidth="2" />
      <circle cx="31" cy="84" r="2" className="text-accent" fill="currentColor" />
    </svg>
  );
}
