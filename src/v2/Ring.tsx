"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A ring of cards turned with the thumb: the front card faces you, the
 * others turn away on their own axis as they recede, and the ring wraps, so
 * sliding right forever keeps bringing the next one round. A tap on the
 * front card opens it; a tap on a side card brings it to the front.
 */
export function Ring<T>({ items, render, label, onOpen, start = 0 }: { items: T[]; render: (item: T, front: boolean) => React.ReactNode; label: (item: T, i: number) => React.ReactNode; onOpen: (item: T, i: number) => void; start?: number }) {
  const n = items.length;
  const [pos, setPos] = useState(start);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; pos: number; moved: boolean; t: number; vx: number; lastX: number; card: number | null } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const width = useRef(300);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => (width.current = el.clientWidth));
    ro.observe(el);
    width.current = el.clientWidth;
    return () => ro.disconnect();
  }, []);

  const step = () => width.current * 0.62;
  const onDown = (e: React.PointerEvent) => {
    if (n < 2) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-card]")?.dataset.card;
    drag.current = { x: e.clientX, pos, moved: false, t: e.timeStamp, vx: 0, lastX: e.clientX, card: card === undefined ? null : Number(card) };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    if (!d.moved) return;
    const now = e.timeStamp;
    d.vx = (e.clientX - d.lastX) / Math.max(1, now - d.t);
    d.t = now;
    d.lastX = e.clientX;
    setPos(d.pos - dx / step());
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      // A tap: the front card opens, a side card comes round.
      if (d.card === null) return;
      let dd = d.card - pos;
      dd = ((((dd + n / 2) % n) + n) % n) - n / 2;
      if (Math.round(dd) === 0) onOpen(items[d.card], d.card);
      else setPos((p) => Math.round(p + dd));
      return;
    }
    // Settle on the nearest card, a flick carrying one further.
    const fling = Math.abs(d.vx) > 0.4 ? -Math.sign(d.vx) : 0;
    setPos((p) => Math.round(p + fling));
  };
  const front = ((Math.round(pos) % n) + n) % n;

  return (
    <div className="grid gap-4">
      <div
        ref={stage}
        className={`p-ring relative h-[min(84vw,540px)] w-full ${dragging ? "is-dragging" : ""}`}
        style={{ touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {items.map((item, i) => {
          // Signed distance from the front, wrapped so the ring has no ends.
          let d = i - pos;
          d = ((((d + n / 2) % n) + n) % n) - n / 2;
          const a = Math.abs(d);
          const hidden = a > 2.5;
          const isFront = Math.round(d) === 0 && !dragging;
          return (
            <button
              key={i}
              type="button"
              tabIndex={hidden ? -1 : 0}
              aria-hidden={hidden}
              aria-label={typeof label(item, i) === "string" ? (label(item, i) as string) : undefined}
              data-card={i}
              className="p-ring-card w-[62%] text-left"
              style={{
                transform: `translate(-50%, -50%) translateX(${d * 72}%) translateZ(${-a * 160}px) rotateY(${-d * 42}deg) scale(${1 - a * 0.08})`,
                opacity: hidden ? 0 : 1 - a * 0.22,
                zIndex: 10 - Math.round(a * 2),
                pointerEvents: hidden ? "none" : "auto",
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (Math.round(d) === 0) onOpen(item, i);
                else setPos((p) => Math.round(p + d));
              }}
            >
              {render(item, isFront)}
            </button>
          );
        })}
      </div>
      <div className="min-h-[4.2rem] text-center" aria-live="polite">
        {label(items[front], front)}
      </div>
    </div>
  );
}
