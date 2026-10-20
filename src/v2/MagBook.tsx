"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The magazine as a book in the hand, with a camera over it.
 *
 * It opens on the closed cover; the cover swings open from right to left and
 * the camera pulls back to show the spread, holds it two seconds, then moves
 * in on the left page. A swipe takes the camera to the right page. The next
 * swipe pulls back to the whole spread, the leaf turns, and the camera moves
 * in on the new left page, and so on. Swiping back runs it in reverse, down
 * to closing the cover.
 *
 * Page numbers: -1 is the cover, -2 the inside board of the closed book, and
 * anything past the last page is blank paper. Spread s holds pages 2s (left)
 * and 2s + 1 (right); the cover's back is page 0.
 */

type Cam = "cover" | "wide" | "L" | "R";
type Leaf = { front: number; back: number; angle: 0 | -180; moving: boolean };

const CAM_MS = 720;
const FLIP_MS = 950;
const HOLD_MS = 2000;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function MagBook({ cover, pages, labels, className = "" }: { cover: React.ReactNode; pages: React.ReactNode[]; labels: { cover: string; page: string; next: string; prev: string }; className?: string }) {
  const n = pages.length;
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spread, setSpread] = useState(-1);
  const [cam, setCam] = useState<Cam>("cover");
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const [under, setUnder] = useState<{ L: number; R: number } | null>(null);
  // Where the reader is: 0 the cover, j + 1 page j.
  const [pos, setPos] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const opened = useRef(false);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const wait = useCallback((ms: number) => new Promise<void>((r) => setTimeout(r, reducedMotion() ? 0 : ms)), []);
  const flip = useCallback(
    async (front: number, back: number, from: 0 | -180, to: 0 | -180) => {
      setLeaf({ front, back, angle: from, moving: false });
      await frame();
      await frame();
      setLeaf({ front, back, angle: to, moving: true });
      await wait(FLIP_MS);
    },
    [wait],
  );

  /** One step forward: open the cover, pan to the right page, or turn the leaf. */
  const next = useCallback(async () => {
    if (busy.current || n === 0) return;
    busy.current = true;
    try {
      if (pos === 0) {
        opened.current = true;
        setCam("wide");
        await wait(200);
        setUnder({ L: -2, R: 1 });
        await flip(-1, 0, 0, -180);
        if (!alive.current) return;
        setSpread(0);
        setUnder(null);
        setLeaf(null);
        await wait(HOLD_MS);
        if (!alive.current) return;
        setCam("L");
        setPos(1);
        await wait(CAM_MS);
        return;
      }
      const j = pos - 1;
      if (j % 2 === 0) {
        if (j + 1 >= n) return;
        setCam("R");
        setPos(pos + 1);
        await wait(CAM_MS);
        return;
      }
      // From a right page to the next spread.
      if (j + 1 >= n) return;
      const s = (j - 1) / 2;
      setCam("wide");
      await wait(CAM_MS);
      setUnder({ L: 2 * s, R: 2 * s + 3 });
      await flip(2 * s + 1, 2 * s + 2, 0, -180);
      if (!alive.current) return;
      setSpread(s + 1);
      setUnder(null);
      setLeaf(null);
      await wait(520);
      setCam("L");
      setPos(pos + 1);
      await wait(CAM_MS);
    } finally {
      busy.current = false;
    }
  }, [flip, n, pos, wait]);

  /** One step back: pan to the left page, turn the leaf back, or close the cover. */
  const prev = useCallback(async () => {
    if (busy.current || pos === 0) return;
    busy.current = true;
    try {
      const j = pos - 1;
      if (j % 2 === 1) {
        setCam("L");
        setPos(pos - 1);
        await wait(CAM_MS);
        return;
      }
      const s = j / 2;
      setCam("wide");
      await wait(CAM_MS);
      if (s === 0) {
        setUnder({ L: -2, R: 1 });
        await flip(-1, 0, -180, 0);
        if (!alive.current) return;
        setSpread(-1);
        setUnder(null);
        setLeaf(null);
        setCam("cover");
        setPos(0);
        await wait(CAM_MS);
        return;
      }
      setUnder({ L: 2 * s - 2, R: 2 * s + 1 });
      await flip(2 * s - 1, 2 * s, -180, 0);
      if (!alive.current) return;
      setSpread(s - 1);
      setUnder(null);
      setLeaf(null);
      await wait(520);
      setCam("R");
      setPos(pos - 1);
      await wait(CAM_MS);
    } finally {
      busy.current = false;
    }
  }, [flip, pos, wait]);

  // The cover opens on its own a moment after the page appears.
  useEffect(() => {
    if (n === 0 || size.w === 0 || opened.current) return;
    const id = setTimeout(() => void next(), 900);
    return () => clearTimeout(id);
  }, [n, size.w, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") void next();
      else if (e.key === "ArrowLeft") void prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // A swipe turns; a wheel turns one step at a time.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) void (dx < 0 ? next() : prev());
  };
  const wheelAt = useRef(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 10) return;
      e.preventDefault();
      if (e.timeStamp - wheelAt.current < 700) return;
      wheelAt.current = e.timeStamp;
      void (d > 0 ? next() : prev());
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [next, prev]);

  // The book's size: two pages side by side fill the stage at the wide shot.
  const pageW = Math.max(1, Math.min(size.w * 0.47, ((size.h * 0.84) * 2) / 3));
  const pageH = pageW * 1.5;
  const zoom = Math.min((size.w * 0.94) / pageW, (size.h * 0.94) / pageH);
  const coverZoom = Math.min((size.w * 0.8) / pageW, (size.h * 0.82) / pageH);
  const camera =
    cam === "wide"
      ? "translate3d(0,0,0) scale(1)"
      : cam === "L"
        ? `translate3d(${(pageW / 2) * zoom}px,0,0) scale(${zoom})`
        : cam === "R"
          ? `translate3d(${(-pageW / 2) * zoom}px,0,0) scale(${zoom})`
          : `translate3d(${(-pageW / 2) * coverZoom}px,0,0) scale(${coverZoom})`;

  const node = (k: number) =>
    k === -1 ? cover : k === -2 ? <div className="aspect-[2/3] w-full bg-[#141210]" /> : k >= 0 && k < n ? pages[k] : <div className="aspect-[2/3] w-full bg-[#efe7d6]" />;
  const left = under ? under.L : spread < 0 ? -2 : 2 * spread;
  const right = under ? under.R : spread < 0 ? 1 : 2 * spread + 1;
  // The closed book is its cover: a leaf lying on the right, not turning.
  const shownLeaf: Leaf | null = leaf ?? (spread < 0 ? { front: -1, back: 0, angle: 0, moving: false } : null);
  const smooth = !reducedMotion();

  const label = pos === 0 ? labels.cover : labels.page.replace("{n}", String(pos));

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={stage} className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden bg-[radial-gradient(ellipse_70%_55%_at_50%_52%,#2a231f_0%,#141110_62%,#0b0a09_100%)]" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)} onDragStart={(e) => e.preventDefault()}>
        {size.w > 0 && (
          <div className="absolute inset-0" style={{ transform: camera, transformOrigin: "50% 50%", transition: smooth ? `transform ${CAM_MS}ms cubic-bezier(0.65, 0, 0.35, 1)` : "none", willChange: "transform" }}>
            <div className="absolute" style={{ left: (size.w - 2 * pageW) / 2, top: (size.h - pageH) / 2, width: 2 * pageW, height: pageH, perspective: `${pageW * 5}px` }}>
              {/* The two pages lying open, with the shade of the gutter. */}
              <div className="absolute top-0 left-0 overflow-hidden shadow-[-18px_24px_40px_-24px_rgb(0_0_0/0.9)]" style={{ width: pageW, height: pageH, opacity: left === -2 && spread < 0 && !leaf ? 0 : 1 }}>
                {node(left)}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[14%]" style={{ background: "linear-gradient(to left, rgb(0 0 0 / 0.28), transparent)" }} />
              </div>
              <div className="absolute top-0 overflow-hidden shadow-[18px_24px_40px_-24px_rgb(0_0_0/0.9)]" style={{ left: pageW, width: pageW, height: pageH }}>
                {node(right)}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[14%]" style={{ background: "linear-gradient(to right, rgb(0 0 0 / 0.24), transparent)" }} />
              </div>
              {/* The turning leaf: hinged on the spine, its front on the right, its back on the left. */}
              {shownLeaf && (
                <div
                  className="absolute top-0"
                  style={{
                    left: pageW,
                    width: pageW,
                    height: pageH,
                    transformOrigin: "0 50%",
                    transformStyle: "preserve-3d",
                    transform: `rotateY(${shownLeaf.angle}deg)`,
                    transition: shownLeaf.moving && smooth ? `transform ${FLIP_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1)` : "none",
                    zIndex: 5,
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden shadow-[12px_20px_36px_-20px_rgb(0_0_0/0.9)]" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                    {node(shownLeaf.front)}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[12%]" style={{ background: "linear-gradient(to right, rgb(0 0 0 / 0.22), transparent)" }} />
                  </div>
                  <div className="absolute inset-0 overflow-hidden" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                    {node(shownLeaf.back)}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[12%]" style={{ background: "linear-gradient(to left, rgb(0 0 0 / 0.26), transparent)" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-bone disabled:opacity-25" onClick={() => void prev()} disabled={pos === 0} aria-label={labels.prev}>
          <span aria-hidden className="text-[1.3rem] leading-none">‹</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1" aria-hidden>
          {Array.from({ length: n + 1 }, (_, k) => (
            <span key={k} className={`h-[3px] min-w-0 flex-1 rounded-full transition-colors ${k === pos ? "bg-accent" : k < pos ? "bg-bone/55" : "bg-bone/20"}`} />
          ))}
        </div>
        <span className="p-stamp shrink-0 text-bone-dim tabular-nums" aria-live="polite">
          {label}
        </span>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-bone disabled:opacity-25" onClick={() => void next()} disabled={pos >= n} aria-label={labels.next}>
          <span aria-hidden className="text-[1.3rem] leading-none">›</span>
        </button>
      </div>
    </div>
  );
}
