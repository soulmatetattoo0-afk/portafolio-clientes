"use client";

import gsap from "gsap";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * The five objects that stand on the ring, one per category. Each one idles
 * on its own (floats, glows, twinkles) and, when chosen, plays its entrance:
 * the painting pulls you through the frame, the sketchbook lights its idea,
 * the finger presses the sign, the table's hologram flares. `select()`
 * resolves with the rectangle the panel should grow out of.
 */
export interface ObjectHandle {
  select(): Promise<DOMRect>;
  reset(): void;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the opening sits inside /deck/frame.webp (736 × 1104). */
const OPENING = { left: "23.1%", top: "19.4%", width: "55%", height: "61.7%" };

/* 02 · The gallery: a gilded frame with the artist's own work hanging in it. */
export const GalleryFrame = forwardRef<ObjectHandle, { photos: string[]; count: number }>(function GalleryFrame({ photos, count }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const opening = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (photos.length < 2 || reduced()) return;
    const t = setInterval(() => setI((v) => (v + 1) % photos.length), 3400);
    return () => clearInterval(t);
  }, [photos.length]);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, opening.current], { clearProps: "all" }),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        const hole = opening.current!;
        if (reduced()) return resolve(hole.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(hole.getBoundingClientRect()) })
          .to(el, { scale: 1.05, y: -6, duration: 0.2, ease: "power2.out" })
          .to(el, { scale: 2.6, duration: 0.62, ease: "power3.in" })
          .to(hole, { filter: "brightness(1.9) contrast(0.9)", duration: 0.4, ease: "power2.in" }, "<0.22");
      }),
  }));

  return (
    <div ref={root} className="p-float relative aspect-[736/1104] w-full origin-center will-change-transform">
      <div ref={opening} className="absolute overflow-hidden bg-[radial-gradient(ellipse_at_center,#123b2d,#071a13_75%)]" style={OPENING}>
        {photos.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms] ease-out ${k === i ? "p-kenburns opacity-100" : "opacity-0"}`}
          />
        ))}
        {!photos.length && (
          <span aria-hidden className="p-gothic absolute inset-0 grid place-items-center text-[5rem] text-bone/20">
            {String(count).padStart(2, "0")}
          </span>
        )}
        <div aria-hidden className="absolute inset-0 shadow-[inset_0_0_36px_rgb(0_0_0/0.75)]" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/deck/frame.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      <div aria-hidden className="p-sheen absolute inset-0" style={{ maskImage: "url(/deck/frame.webp)", WebkitMaskImage: "url(/deck/frame.webp)", maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }} />
    </div>
  );
});

/* 03 · Designs: the sketchbook floats open, the idea lit above it. */
export const Sketchbook = forwardRef<ObjectHandle, object>(function Sketchbook(_, ref) {
  const root = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLImageElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, book.current, glow.current], { clearProps: "all" }),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        if (reduced()) return resolve(el.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
          .to(glow.current, { scale: 2.4, opacity: 1, duration: 0.42, ease: "power2.out" })
          .to(book.current, { y: -18, rotateX: 14, scale: 1.08, duration: 0.42, ease: "power2.out", transformPerspective: 700 }, "<")
          .to(glow.current, { scale: 7, opacity: 0.95, duration: 0.5, ease: "power3.in" }, ">-0.05")
          .to(el, { scale: 2.2, duration: 0.5, ease: "power3.in" }, "<");
      }),
  }));

  return (
    <div ref={root} className="relative aspect-[545/600] w-full origin-center will-change-transform">
      <div
        ref={glow}
        aria-hidden
        className="p-bulb absolute aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: "50%", top: "17%", background: "radial-gradient(circle, rgb(255 222 140 / 0.95), rgb(255 190 80 / 0.4) 36%, transparent 68%)", filter: "blur(5px)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={book} src="/deck/sketchbook.webp" alt="" draggable={false} className="p-float absolute inset-0 h-full w-full object-contain select-none" />
    </div>
  );
});

/* 04 · Request: a finger about to press the sign. */
export const ReserveSign = forwardRef<ObjectHandle, { label: string }>(function ReserveSign({ label }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const hand = useRef<SVGGElement>(null);
  const plate = useRef<SVGRectElement>(null);
  const text = useRef<SVGTextElement>(null);
  const ripple = useRef<SVGCircleElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, hand.current, plate.current, text.current, ripple.current], { clearProps: "all" }),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        if (reduced()) return resolve(el.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
          .to(hand.current, { y: -14, duration: 0.22, ease: "power2.in" })
          .to(plate.current, { scale: 0.94, fill: "var(--accent)", transformOrigin: "50% 50%", duration: 0.12, ease: "power1.out" }, "<0.14")
          .to(text.current, { fill: "#0a0a0a", duration: 0.12 }, "<")
          .fromTo(ripple.current, { attr: { r: 12 }, opacity: 0.9 }, { attr: { r: 150 }, opacity: 0, duration: 0.6, ease: "power2.out" }, "<")
          .to(hand.current, { y: -8, duration: 0.18, ease: "power1.out" }, "<0.1")
          .to(el, { scale: 2.1, duration: 0.45, ease: "power3.in" }, "<0.1");
      }),
  }));

  return (
    <div ref={root} className="relative aspect-square w-full origin-center will-change-transform">
      <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible text-bone" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle ref={ripple} cx="100" cy="54" r="12" stroke="var(--accent)" strokeWidth="3" opacity="0" />
        <rect ref={plate} x="12" y="20" width="176" height="68" rx="12" fill="rgb(10 10 10 / 0.6)" />
        <text ref={text} x="100" y="66" textAnchor="middle" fill="currentColor" stroke="none" className="p-display" style={{ fontSize: label.length > 8 ? 30 : 36, letterSpacing: "0.02em" }}>
          {label}
        </text>
        <g ref={hand} className="p-hover" style={{ transformOrigin: "100px 140px" }} fill="#0a0a0a">
          {/* the fist: three folded fingers on top, the palm below */}
          <path d="M86 132 a11 11 0 0 1 22 0 a11 11 0 0 1 22 0 a11 11 0 0 1 22 0 v24 a28 28 0 0 1 -28 28 h-52 a22 22 0 0 1 -22 -22 v-20 z" />
          <path d="M108 132 v14 M130 132 v14" />
          {/* the index finger, pointing up at the sign */}
          <path d="M64 158 V76 a11 11 0 0 1 22 0 v56" />
          {/* the thumb, folded over the side */}
          <path d="M64 146 c-10 -2 -18 6 -14 15 c3 7 9 10 14 11" />
        </g>
      </svg>
    </div>
  );
});

/* 05 · Guest spots: the round table projecting the world. */
export const WorldTable = forwardRef<ObjectHandle, object>(function WorldTable(_, ref) {
  const root = useRef<HTMLDivElement>(null);
  const beam = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, beam.current], { clearProps: "all" }),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        if (reduced()) return resolve(el.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
          .to(beam.current, { scale: 2.2, opacity: 1, duration: 0.35, ease: "power2.out" })
          .to(el, { rotateX: 10, scale: 1.08, y: -8, duration: 0.35, ease: "power2.out", transformPerspective: 800 }, "<")
          .to(beam.current, { scale: 9, duration: 0.5, ease: "power3.in" }, ">-0.05")
          .to(el, { scale: 2.4, duration: 0.5, ease: "power3.in" }, "<");
      }),
  }));

  const sparks = [
    [22, 30, 0],
    [38, 18, 0.7],
    [61, 14, 1.4],
    [78, 26, 0.3],
    [30, 46, 1.9],
    [70, 44, 1.1],
    [50, 36, 2.3],
  ];

  return (
    <div ref={root} className="relative aspect-square w-full origin-center will-change-transform">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/deck/table.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain select-none"
        style={{ maskImage: "radial-gradient(ellipse 64% 60% at 50% 52%, black 52%, transparent 82%)", WebkitMaskImage: "radial-gradient(ellipse 64% 60% at 50% 52%, black 52%, transparent 82%)" }}
      />
      <div
        ref={beam}
        aria-hidden
        className="p-beam absolute aspect-square w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: "50%", top: "50%", background: "radial-gradient(circle, rgb(255 208 110 / 0.75), rgb(255 170 60 / 0.25) 40%, transparent 65%)", mixBlendMode: "screen", filter: "blur(6px)" }}
      />
      {sparks.map(([x, y, d], k) => (
        <span key={k} aria-hidden className="p-twinkle absolute h-[3px] w-[3px] rounded-full bg-[#ffd98a]" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
      ))}
    </div>
  );
});

/* 01 · The artist: a print of the poster, taped up. */
export const Portrait = forwardRef<ObjectHandle, { src: string | null; name: string; grey: boolean }>(function Portrait({ src, name, grey }, ref) {
  const root = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set(root.current, { clearProps: "all" }),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        if (reduced()) return resolve(el.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
          .to(el, { rotate: 0, scale: 1.06, duration: 0.28, ease: "power2.out" })
          .to(el, { scale: 2.3, duration: 0.55, ease: "power3.in" });
      }),
  }));

  return (
    <div ref={root} className="p-float-slow relative mx-auto aspect-[3/4.2] w-[86%] origin-center -rotate-2 bg-bone p-[4%] pb-[11%] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] will-change-transform">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className={`h-full w-full object-cover object-top select-none ${grey ? "grayscale" : ""}`} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-ink-2">
          <span className="p-display text-[3rem] text-bone/30">{name.slice(0, 1)}</span>
        </div>
      )}
      <span aria-hidden className="absolute -top-[3%] left-[8%] h-[5%] w-[26%] -rotate-6 bg-[#e9dfc4]/70 shadow-sm" />
      <span aria-hidden className="absolute -top-[3%] right-[8%] h-[5%] w-[26%] rotate-6 bg-[#e9dfc4]/70 shadow-sm" />
      <span className="p-quote absolute right-0 bottom-[2.5%] left-0 text-center text-[clamp(0.8rem,3.2vw,1rem)] text-ink/80">{name}</span>
    </div>
  );
});
