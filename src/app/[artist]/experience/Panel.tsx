"use client";

import { useEffect, useRef, useState } from "react";

import { PANELS, type ExperienceData, type PanelId } from "./types";

/**
 * Full-screen stage for one category. It opens by growing out of the card
 * rectangle (clip-path), scrolls on its own, and carries the back / next bar.
 */
export function Panel({
  id,
  data,
  from,
  onBack,
  onGo,
  children,
}: {
  id: PanelId;
  data: ExperienceData;
  from: DOMRect | null;
  onBack: () => void;
  onGo: (id: PanelId) => void;
  children: React.ReactNode;
}) {
  const a = data.t.artist;
  const c = a.deck.cards[id];
  const i = PANELS.indexOf(id);
  const prev = i > 0 ? PANELS[i - 1] : null;
  const next = i < PANELS.length - 1 ? PANELS[i + 1] : null;
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(!from);

  // Start clipped to the card, then release to the full screen on the next frame.
  useEffect(() => {
    if (!from) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(id);
  }, [from]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    scroller.current?.focus({ preventScroll: true });
  }, [id]);

  const clip = from && !open ? `inset(${from.top}px ${window.innerWidth - from.right}px ${window.innerHeight - from.bottom}px ${from.left}px round 22px)` : "inset(0 round 0)";

  return (
    <section
      aria-labelledby={`panel-${id}`}
      className="fixed inset-0 z-30 flex flex-col bg-ink text-bone"
      style={{ clipPath: clip, transition: "clip-path 560ms var(--ease-out-quart)" }}
    >
      <div className="p-grain" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between gap-2 border-b border-line/70 bg-ink/85 px-3 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2 backdrop-blur-md">
        <button type="button" onClick={onBack} className="btn btn-ghost -ml-1 gap-2 text-bone" aria-label={a.panel.back}>
          <span aria-hidden className="text-[1.3rem] leading-none">←</span>
          <span className="p-stamp hidden sm:inline">{a.panel.back}</span>
        </button>
        <span className="p-stamp truncate text-bone-dim">{c.kicker}</span>
        <div className="flex">
          <button type="button" className="btn btn-ghost px-2 text-bone disabled:opacity-25" onClick={() => prev && onGo(prev)} disabled={!prev} aria-label={a.panel.prev}>
            <span aria-hidden>‹</span>
          </button>
          <button type="button" className="btn btn-ghost px-2 text-bone disabled:opacity-25" onClick={() => next && onGo(next)} disabled={!next} aria-label={a.panel.next}>
            <span aria-hidden>›</span>
          </button>
        </div>
      </header>
      <div ref={scroller} tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-width:thin]">
        <div className={`mx-auto w-full max-w-3xl ${open ? "p-immerse" : "opacity-0"}`} style={{ animationDelay: "160ms" }}>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Panel title block: the ordinal stamp, the giant word, the lead. */
export function PanelHead({ id, title, lead, kicker }: { id: PanelId; title: string; lead?: string; kicker: string }) {
  return (
    <div className="relative px-5 pt-8 pb-6">
      <div className="p-halftone" aria-hidden />
      <p className="p-stamp relative text-accent">{kicker}</p>
      <h2 id={`panel-${id}`} className="p-display relative mt-2 text-[clamp(3.4rem,17vw,7rem)] text-bone">
        {title}
      </h2>
      {lead && <p className="relative mt-4 max-w-[46ch] text-[1rem] leading-relaxed text-bone/85">{lead}</p>}
    </div>
  );
}
