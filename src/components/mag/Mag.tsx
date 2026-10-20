"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MagChapter {
  key: string;
  label: string;
  node: React.ReactNode;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The digital magazine: full-screen chapters that slide sideways. The thumb
 * drags the run of pages and lets go; it settles on the nearest page, a flick
 * carrying one further. A wheel and the arrow keys turn one at a time; a
 * progress bar at the foot shows where you are. The run is moved with a
 * transform, never native scrolling, so every phone turns pages the same way.
 * `initialKey` opens on a chapter; `onChange` hears every turn, for the URL.
 */
export function Mag({ chapters, labels, initialKey, onChange, className = "h-[calc(100dvh-4.2rem)] min-h-[520px]" }: { chapters: MagChapter[]; labels: { page: string; next: string; prev: string }; initialKey?: string; onChange?: (key: string) => void; className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const start = Math.max(0, initialKey ? chapters.findIndex((c) => c.key === initialKey) : 0);
  const [i, setI] = useState(start);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const n = chapters.length;
  const lock = useRef(0);
  const drag = useRef<{ x: number; y: number; moved: boolean; vertical: boolean; t: number; vx: number; lastX: number } | null>(null);
  const reported = useRef(start);

  const go = useCallback((k: number) => setI(Math.max(0, Math.min(n - 1, k))), [n]);

  // A mouse wheel turns chapters one at a time.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 8) return;
      e.preventDefault();
      const now = e.timeStamp;
      if (now - lock.current < 650) return;
      lock.current = now;
      go(i + (d > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [go, i]);

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

  const onDown = (e: React.PointerEvent) => {
    if (n < 2 || e.button > 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, vertical: false, t: e.timeStamp, vx: 0, lastX: e.clientX };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = stage.current;
    if (!d || !el || d.vertical) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      // A vertical start is the page scrolling, not a turn.
      if (Math.abs(my) > Math.abs(mx)) {
        d.vertical = true;
        return;
      }
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const now = e.timeStamp;
    d.vx = (e.clientX - d.lastX) / Math.max(1, now - d.t);
    d.t = now;
    d.lastX = e.clientX;
    // The ends resist.
    const w = el.clientWidth;
    const over = (i === 0 && mx > 0) || (i === n - 1 && mx < 0);
    setDx(over ? mx * 0.3 : Math.max(-w, Math.min(w, mx)));
  };
  const onUp = () => {
    const d = drag.current;
    const el = stage.current;
    drag.current = null;
    setDragging(false);
    if (!d || !el || !d.moved) {
      setDx(0);
      return;
    }
    const w = el.clientWidth;
    const flick = Math.abs(d.vx) > 0.35;
    const far = Math.abs(dx) > w * 0.28;
    if ((flick || far) && dx < 0) go(i + 1);
    else if ((flick || far) && dx > 0) go(i - 1);
    setDx(0);
  };
  // A drag must not land as a click on whatever is under the thumb.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragging || Math.abs(dx) > 0) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div className={`mag-root flex flex-col ${className}`} data-active={chapters[i]?.key}>
      <div
        ref={stage}
        className="mag-stage relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translate3d(calc(${-i * 100}% + ${dx}px), 0, 0)`,
            transition: dragging || reduced() ? "none" : "transform 520ms var(--ease-out-quart)",
            willChange: "transform",
          }}
        >
          {chapters.map((c, k) => (
            <div key={c.key} data-key={c.key} className={`h-full w-full flex-none ${Math.abs(k - i) <= 1 ? "" : "invisible"}`}>
              <div className={`mag-page h-full w-full ${k === i ? "is-current" : ""}`}>{c.node}</div>
            </div>
          ))}
        </div>
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
