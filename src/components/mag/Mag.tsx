"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MagChapter {
  key: string;
  label: string;
  node: React.ReactNode;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The digital magazine: full-screen chapters that slide sideways. A wheel,
 * the arrow keys and a mouse drag turn one chapter at a time; a progress
 * bar at the foot shows where you are. `initialKey` opens on a chapter
 * without animation; `onChange` hears every turn, for the URL.
 */
export function Mag({ chapters, labels, initialKey, onChange, className = "h-[calc(100dvh-4.2rem)] min-h-[520px]" }: { chapters: MagChapter[]; labels: { page: string; next: string; prev: string }; initialKey?: string; onChange?: (key: string) => void; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const start = Math.max(0, initialKey ? chapters.findIndex((c) => c.key === initialKey) : 0);
  const [i, setI] = useState(start);
  const n = chapters.length;
  const lock = useRef(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const reported = useRef(start);
  const opened = useRef(start);

  const go = useCallback(
    (k: number) => {
      const el = scroller.current;
      if (!el) return;
      const to = Math.max(0, Math.min(n - 1, k));
      el.scrollTo({ left: to * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
    },
    [n],
  );

  // Open on the asked-for chapter, before anything paints.
  useEffect(() => {
    const el = scroller.current;
    const k = opened.current;
    if (!el || k === 0) return;
    el.scrollTo({ left: k * el.clientWidth, behavior: "auto" });
  }, []);

  // Which chapter is in view, and the reveal class on each one.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting)),
      { root: el, threshold: 0.45 },
    );
    el.querySelectorAll(".mag-ch").forEach((s) => io.observe(s));
    // A mouse wheel turns chapters one at a time.
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 8) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lock.current < 650) return;
      lock.current = now;
      go(Math.round(el.scrollLeft / el.clientWidth) + (d > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      io.disconnect();
    };
  }, [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i]);

  // Tell the owner when the page turns, once per turn.
  useEffect(() => {
    if (!onChange || i === reported.current || !chapters[i]) return;
    reported.current = i;
    onChange(chapters[i].key);
  }, [i, onChange, chapters]);

  // Mouse drag: the chapters follow the pointer, then settle on the nearest one.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !scroller.current) return;
    drag.current = { x: e.clientX, left: scroller.current.scrollLeft, moved: false };
    scroller.current.style.scrollSnapType = "none";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    el.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = scroller.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.scrollSnapType = "";
    const dx = e.clientX - d.x;
    const from = Math.round(d.left / el.clientWidth);
    go(Math.abs(dx) > 60 ? from - Math.sign(dx) : from);
  };

  return (
    <div className={`mag-root flex flex-col ${className}`} data-active={chapters[i]?.key}>
      <div
        ref={scroller}
        className="mag-scroll relative min-h-0 flex-1 touch-pan-x select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
      >
        {chapters.map((c) => (
          <div key={c.key} data-key={c.key} className="h-full w-full flex-none snap-start">
            {c.node}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <button type="button" className="btn btn-ghost btn-sm text-bone disabled:opacity-25" onClick={() => go(i - 1)} disabled={i === 0} aria-label={labels.prev}>
          <span aria-hidden className="text-[1.2rem] leading-none">‹</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist" aria-label={labels.page}>
          {chapters.map((c, k) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`${c.label} · ${k + 1}`}
              title={c.label}
              onClick={() => go(k)}
              className={`h-[3px] min-w-0 flex-1 rounded-full transition-colors ${k === i ? "bg-accent" : k < i ? "bg-bone/55" : "bg-bone/20"}`}
            />
          ))}
        </div>
        <span className="p-stamp shrink-0 text-bone-dim tabular-nums">
          {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <button type="button" className="btn btn-ghost btn-sm text-bone disabled:opacity-25" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label={labels.next}>
          <span aria-hidden className="text-[1.2rem] leading-none">›</span>
        </button>
      </div>
      <p className="p-stamp sr-only">{chapters[i]?.label}</p>
    </div>
  );
}
