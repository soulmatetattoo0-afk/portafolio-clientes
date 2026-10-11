"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LangToggle } from "@/components/LangToggle";
import { VantaHome } from "@/components/brand/VantaHome";
import { CoverSheet } from "@/components/magazine/Sheet";
import { SaveButton } from "@/components/world/SaveButton";
import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

import { GalleryFrame, Portrait, ReserveSign, Signpost, Sketchbook, type ObjectHandle } from "./objects";
import { PANELS, type ExperienceData, type PanelId } from "./types";

const N = PANELS.length;
/** Signed distance of card i from the front, in card steps, wrapped onto (-N/2, N/2]. */
const dist = (i: number, angle: number) => ((((i - angle) % N) + N + N / 2) % N) - N / 2;

/**
 * The deck: five objects stand on a ring, one per category: the taped-up
 * poster, the gilded frame, the sketchbook, the sign with the finger, the
 * table projecting the world. The front one faces you, the others curve
 * away on both sides; drag with a thumb and the ring turns, the one leaving
 * on the left comes back round on the right. Tap the front object and it
 * plays its entrance, then its panel opens out of it.
 */
export function Deck({ data, initial, active, onOpen }: { data: ExperienceData; initial: PanelId; active: boolean; onOpen: (id: PanelId, from: DOMRect) => void }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const objects = useRef<(ObjectHandle | null)[]>([]);
  const [angle, setAngle] = useState(PANELS.indexOf(initial));
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const drag = useRef({ x0: 0, a0: 0, moved: false, lastX: 0, lastT: 0, v: 0, hit: -1 });
  const current = ((Math.round(angle) % N) + N) % N;

  const step = () => Math.max(160, Math.min(stage.current?.clientWidth ?? 320, 520) * 0.62);

  // Coming back from a panel: put every object back where it idles.
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpening(null);
    objects.current.forEach((o) => o?.reset());
  }, [active]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (opening !== null) return;
    // Remember which card the finger landed on: with the pointer captured by the stage, the click never reaches the card.
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
    drag.current = { x0: e.clientX, a0: angle, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0, hit: hit ? Number(hit.dataset.card) : -1 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const d = drag.current;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 6) d.moved = true;
    const now = e.timeStamp;
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
    async (i: number) => {
      const c = cards.current[i];
      if (!c) return;
      setOpening(i);
      const rect = (await objects.current[i]?.select()) ?? c.getBoundingClientRect();
      onOpen(PANELS[i], rect);
    },
    [onOpen],
  );

  const tap = (i: number) => {
    if (i !== current) turnTo(i);
    else void open(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight") setAngle((v) => Math.round(v) + 1);
      else if (e.key === "ArrowLeft") setAngle((v) => Math.round(v) - 1);
      else if (e.key === "Enter") void open(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, current, open]);

  const photos = data.portfolio.map((p) => p.url).filter((u): u is string => !!u).slice(0, 6);
  const openCount = data.flash.filter((f) => f.status === "available").length;
  const front = a.deck.cards[PANELS[current]];
  const homeStop = data.stops.find((s) => s.is_home);

  const object = (id: PanelId, i: number) => {
    const set = (el: ObjectHandle | null) => {
      objects.current[i] = el;
    };
    switch (id) {
      case "bio":
        return (
          <Portrait ref={set}>
            <CoverSheet cover={data.magazine.doc.cover} name={artist.display_name} urls={data.magazine.urls} ph={t.magazine.ph} className="h-full" />
          </Portrait>
        );
      case "work":
        return <GalleryFrame ref={set} photos={photos} count={data.portfolio.length} />;
      case "flash":
        return <Sketchbook ref={set} />;
      case "book":
        return <ReserveSign ref={set} label={a.deck.sign.toUpperCase()} />;
      case "spots":
        return (
          <Signpost
            ref={set}
            home={homeStop?.city ?? artist.home_city ?? ""}
            area={homeStop?.studio_name ?? null}
            resident={a.panel.spots.resident}
            guests={Array.from(new Set(data.stops.filter((s) => !s.is_home).map((s) => s.city)))}
          />
        );
    }
  };

  return (
    <div className="p-immerse relative flex h-dvh flex-col overflow-hidden">
      <div className="p-grain" aria-hidden />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),0.9rem)]">
        {/* The way home: VANTA itself, with a small hop now and then. */}
        <VantaHome label={t.artist.backToVanta} />
        <div className="flex items-center gap-1">
          <SaveButton
            artistId={artist.id}
            following={data.following}
            className="h-10 w-10"
            labels={{ save: fill(t.world.card.save, { name: artist.display_name }), saved: t.world.card.saved, signIn: fill(t.world.card.signInToSave, { name: artist.display_name }) }}
          />
          <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
        </div>
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
            ? "translate(-50%, -50%) translateZ(90px)"
            : `translate(-50%, -50%) translateX(${(d * 66).toFixed(2)}%) translateZ(${(-ad * 170).toFixed(1)}px) rotateY(${(-d * 22).toFixed(2)}deg) scale(${(1 - ad * 0.1).toFixed(3)})`;
          const opacity = opening !== null && !isOpening ? 0 : Math.max(0.22, 1 - ad * 0.3);
          return (
            <button
              key={id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={i === current}
              aria-label={c.title}
              data-card={i}
              onClick={(e) => {
                // Pointer taps are handled on the stage; this is for the keyboard.
                if (e.detail === 0) tap(i);
              }}
              style={{ transform, opacity, zIndex: 100 - Math.round(ad * 10), filter: ad > 0.5 ? `brightness(${(1 - ad * 0.25).toFixed(2)})` : undefined }}
              className="p-ring-card flex w-[min(70vw,320px)] flex-col items-center text-center text-bone"
            >
              <div className="w-full px-2">{object(id, i)}</div>
              <span className="p-gothic mt-4 text-[1.05rem] text-accent">{c.kicker}</span>
              <span className="p-display text-[2rem] leading-none">{c.title}</span>
            </button>
          );
        })}
      </div>

      {/* The front object, named below the ring, like the track under a player. */}
      <div className="relative z-10 grid gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.1rem)] text-center">
        <div className="flex items-center justify-center gap-2" aria-hidden>
          {PANELS.map((id, i) => (
            <span key={id} className={`h-[3px] rounded-full transition-all ${i === current ? "w-7 bg-accent" : "w-3 bg-bone/25"}`} />
          ))}
        </div>
        <p className="p-stamp text-bone-dim">{a.deck.hint}</p>
        <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-ink-2/80 py-2 pr-2 pl-5 backdrop-blur">
          <div className="min-w-0 text-left">
            <p className="p-display truncate text-[1.25rem]">{front.title}</p>
            <p className="truncate text-[0.78rem] text-bone-dim">
              {PANELS[current] === "work" && data.portfolio.length ? fill(a.panel.work.count, { n: data.portfolio.length }) : null}
              {PANELS[current] === "flash" && data.flash.length ? `${openCount} ${a.panel.flash.available.toLowerCase()}` : null}
              {PANELS[current] === "spots" && data.stops[1] ? `${data.stops[1].city} · ${dateRange(data.stops[1].starts_on, data.stops[1].ends_on, locale)}` : null}
              {PANELS[current] === "book" ? (artist.accepting ? a.booksOpen : a.booksClosed) : null}
              {PANELS[current] === "bio" ? front.body : null}
            </p>
          </div>
          <button type="button" className="btn btn-accent shrink-0" onClick={() => void open(current)}>
            {a.deck.enter}
          </button>
        </div>
      </div>
    </div>
  );
}
