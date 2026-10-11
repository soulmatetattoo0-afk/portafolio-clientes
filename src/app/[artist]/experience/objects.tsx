"use client";

import gsap from "gsap";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { BRAND } from "@/lib/brand";


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

/** Undo an entrance: only what the timelines touch, never the inline layout. */
const CLEAR = { clearProps: "transform,opacity,filter,fill" };

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the opening sits inside /deck/frame.webp (736 × 1104). */
const OPENING = { left: "23.1%", top: "19.4%", width: "55%", height: "61.7%" };

/* 02 · The gallery: a gilded frame with the artist's own work hanging in it. */
export const GalleryFrame = forwardRef<
  ObjectHandle,
  { photos: string[]; count: number }
>(function GalleryFrame({ photos, count }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const opening = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (photos.length < 2 || reduced()) return;
    const t = setInterval(() => setI((v) => (v + 1) % photos.length), 3400);
    return () => clearInterval(t);
  }, [photos.length]);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, opening.current], CLEAR),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        const hole = opening.current!;
        if (reduced()) return resolve(hole.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(hole.getBoundingClientRect()) })
          .to(el, { scale: 1.05, y: -6, duration: 0.2, ease: "power2.out" })
          .to(el, { scale: 2.6, duration: 0.62, ease: "power3.in" })
          .to(
            hole,
            {
              filter: "brightness(1.9) contrast(0.9)",
              duration: 0.4,
              ease: "power2.in",
            },
            "<0.22",
          );
      }),
  }));

  return (
    <div
      ref={root}
      className="relative aspect-[736/1104] w-full origin-center will-change-transform"
    >
      <div className="p-float absolute inset-0">
        <div
          ref={opening}
          className="absolute overflow-hidden bg-[radial-gradient(ellipse_at_center,#123b2d,#071a13_75%)]"
          style={OPENING}
        >
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
            <span
              aria-hidden
              className="p-gothic absolute inset-0 grid place-items-center text-[5rem] text-bone/20"
            >
              {String(count).padStart(2, "0")}
            </span>
          )}
          <div
            aria-hidden
            className="absolute inset-0 shadow-[inset_0_0_36px_rgb(0_0_0/0.75)]"
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/deck/frame.webp"
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        <div
          aria-hidden
          className="p-sheen absolute inset-0"
          style={{
            maskImage: "url(/deck/frame.webp)",
            WebkitMaskImage: "url(/deck/frame.webp)",
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
          }}
        />
      </div>
    </div>
  );
});

/* 03 · Designs: the sketchbook floats open under a lit bulb; the light lands on the pages. */
export const Sketchbook = forwardRef<ObjectHandle, object>(
  function Sketchbook(_, ref) {
    const root = useRef<HTMLDivElement>(null);
    const book = useRef<HTMLDivElement>(null);
    const glow = useRef<HTMLDivElement>(null);
    const cone = useRef<HTMLDivElement>(null);
    const bulb = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      reset: () =>
        gsap.set(
          [
            root.current,
            book.current,
            glow.current,
            cone.current,
            bulb.current,
          ],
          CLEAR,
        ),
      select: () =>
        new Promise((resolve) => {
          const el = root.current!;
          if (reduced()) return resolve(el.getBoundingClientRect());
          gsap
            .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
            .to(bulb.current, {
              scale: 1.12,
              filter: "brightness(1.6)",
              duration: 0.3,
              ease: "power2.out",
            })
            .to(
              glow.current,
              { scale: 1.8, opacity: 1, duration: 0.34, ease: "power2.out" },
              "<",
            )
            .to(
              cone.current,
              { opacity: 1, scaleX: 1.25, duration: 0.34, ease: "power2.out" },
              "<",
            )
            .to(
              book.current,
              {
                y: -16,
                rotateX: 14,
                scale: 1.07,
                duration: 0.42,
                ease: "power2.out",
                transformPerspective: 700,
              },
              "<0.05",
            )
            .to(
              glow.current,
              { scale: 7, opacity: 0.95, duration: 0.5, ease: "power3.in" },
              ">-0.05",
            )
            .to(el, { scale: 2.2, duration: 0.5, ease: "power3.in" }, "<");
        }),
    }));

    const bookMask = {
      WebkitMaskImage: "url(/deck/sketchbook.webp)",
      maskImage: "url(/deck/sketchbook.webp)",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskPosition: "center bottom",
      maskPosition: "center bottom",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    } as const;

    return (
      <div
        ref={root}
        className="relative aspect-[545/660] w-full origin-center will-change-transform"
      >
        {/* the pool of light behind the bulb */}
        <div
          ref={glow}
          aria-hidden
          className="absolute aspect-square w-[56%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "13%" }}
        >
          <div
            className="p-bulb absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgb(255 226 150 / 0.9), rgb(255 196 90 / 0.4) 30%, rgb(255 170 60 / 0.1) 55%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </div>
        {/* the cone of light falling onto the pages */}
        <div
          ref={cone}
          aria-hidden
          className="absolute left-1/2 top-[16%] h-[46%] w-[70%] -translate-x-1/2 origin-top"
          style={{ opacity: 0.85 }}
        >
          <div
            className="p-flicker absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgb(255 214 130 / 0.55), rgb(255 200 110 / 0.2) 55%, transparent 100%)",
              clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
              mixBlendMode: "screen",
              filter: "blur(7px)",
            }}
          />
        </div>
        {/* the bulb: glass, filament, brass cap */}
        <div
          ref={bulb}
          className="absolute left-1/2 top-0 w-[23%] -translate-x-1/2 origin-center"
        >
          <svg
            viewBox="0 0 100 150"
            aria-hidden
            className="p-flicker block w-full overflow-visible"
            style={{ filter: "drop-shadow(0 0 14px rgb(255 206 110 / 0.9))" }}
          >
            <defs>
              <radialGradient id="p-glass" cx="50%" cy="42%" r="55%">
                <stop offset="0" stopColor="#fff8e1" stopOpacity="1" />
                <stop offset="0.45" stopColor="#ffe6a6" stopOpacity="0.92" />
                <stop offset="1" stopColor="#f0b85a" stopOpacity="0.55" />
              </radialGradient>
              <radialGradient id="p-core" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#fff2c2" />
                <stop offset="1" stopColor="#ffb340" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g
              stroke="#ffd98a"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.8"
              className="p-pulse"
            >
              <path d="M50 -6 V-18 M14 10 L6 2 M86 10 L94 2 M4 48 H-8 M96 48 H108" />
            </g>
            <path
              d="M50 6C25 6 13 26 13 46c0 15 9 25 17 35 4 5 6 10 6 17h28c0-7 2-12 6-17 8-10 17-20 17-35C87 26 75 6 50 6Z"
              fill="url(#p-glass)"
              stroke="#fff1c8"
              strokeWidth="1.5"
            />
            <circle cx="50" cy="60" r="20" fill="url(#p-core)" />
            <path
              d="M40 98V80c0-8 5-12 10-7 5-5 10-1 10 7v18"
              fill="none"
              stroke="#ff9d2e"
              strokeWidth="2.6"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 4px #ffb347)" }}
            />
            <path d="M40 98 v6 M60 98 v6" stroke="#8a6a2a" strokeWidth="2.4" />
            <rect x="35" y="104" width="30" height="8" rx="2" fill="#c9a24f" />
            <rect x="36" y="112" width="28" height="6" fill="#8a6a2a" />
            <rect x="35" y="118" width="30" height="6" fill="#c9a24f" />
            <rect x="36" y="124" width="28" height="6" fill="#8a6a2a" />
            <rect x="35" y="130" width="30" height="6" rx="1" fill="#c9a24f" />
            <rect x="43" y="136" width="14" height="8" rx="3" fill="#5c4418" />
          </svg>
        </div>
        {/* the book, with the light bouncing on its pages */}
        <div ref={book} className="absolute inset-x-0 bottom-0 h-[80%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/deck/sketchbook.webp"
            alt=""
            draggable={false}
            className="p-float absolute inset-0 h-full w-full object-contain object-bottom select-none"
          />
          <div
            aria-hidden
            className="p-float absolute inset-0"
            style={{
              ...bookMask,
              background:
                "radial-gradient(ellipse 48% 36% at 50% 14%, rgb(255 206 120), rgb(255 232 190) 45%, rgb(255 255 255 / 0) 75%)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            aria-hidden
            className="p-float absolute inset-0"
            style={{
              ...bookMask,
              background:
                "radial-gradient(ellipse 40% 30% at 50% 10%, rgb(255 236 180 / 0.55), transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
          {/* the word on the right page */}
          <div className="p-float absolute inset-0">
            <span
              className="p-script p-ink absolute block text-[#241812]"
              style={{
                left: "55%",
                top: "42%",
                width: "32%",
                fontSize: "clamp(1.5rem, 8.5vw, 2.5rem)",
                lineHeight: 1,
                transform: "rotate(-9deg) skewY(-5deg)",
                textAlign: "center",
                textShadow: "0 0.5px 0 rgb(36 24 18 / 0.6)",
                animationDelay: "500ms",
              }}
            >
              create
            </span>
            <svg
              aria-hidden
              viewBox="0 0 120 20"
              className="p-ink absolute"
              style={{
                left: "57%",
                top: "56%",
                width: "26%",
                transform: "rotate(-9deg) skewY(-5deg)",
                animationDelay: "900ms",
              }}
            >
              <path
                d="M4 12c20-8 40 6 60-2s36-8 52 0"
                fill="none"
                stroke="#241812"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.8"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  },
);

/* 04 · Request: a finger about to press the sign. The button has depth and really goes down. */
export const ReserveSign = forwardRef<ObjectHandle, { label: string }>(
  function ReserveSign({ label }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const hand = useRef<SVGGElement>(null);
    const top = useRef<SVGGElement>(null);
    const plate = useRef<SVGRectElement>(null);
    const text = useRef<SVGTextElement>(null);
    const ripple = useRef<SVGCircleElement>(null);

    useImperativeHandle(ref, () => ({
      reset: () =>
        gsap.set(
          [
            root.current,
            hand.current,
            top.current,
            plate.current,
            text.current,
            ripple.current,
          ],
          CLEAR,
        ),
      select: () =>
        new Promise((resolve) => {
          const el = root.current!;
          if (reduced()) return resolve(el.getBoundingClientRect());
          gsap
            .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
            // the finger comes up to the button
            .to(hand.current, { y: -14, duration: 0.22, ease: "power2.in" })
            // the press: button and finger go down together, the face takes the artist's colour
            .to(top.current, { y: 8, duration: 0.09, ease: "power1.out" })
            .to(
              hand.current,
              { y: -7, duration: 0.09, ease: "power1.out" },
              "<",
            )
            .to(plate.current, { fill: "var(--accent)", duration: 0.09 }, "<")
            .to(text.current, { fill: "#0a0a0a", duration: 0.09 }, "<")
            .fromTo(
              ripple.current,
              { attr: { r: 14 }, opacity: 0.9 },
              {
                attr: { r: 160 },
                opacity: 0,
                duration: 0.6,
                ease: "power2.out",
              },
              "<",
            )
            // release
            .to(
              top.current,
              { y: 0, duration: 0.16, ease: "back.out(2)" },
              ">-0.42",
            )
            .to(
              hand.current,
              { y: -14, duration: 0.16, ease: "power1.out" },
              "<",
            )
            .to(el, { scale: 2.1, duration: 0.45, ease: "power3.in" }, "<0.08");
        }),
    }));

    return (
      <div
        ref={root}
        className="relative aspect-square w-full origin-center will-change-transform"
      >
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full overflow-visible text-bone"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle
            ref={ripple}
            cx="100"
            cy="54"
            r="14"
            stroke="var(--accent)"
            strokeWidth="3"
            opacity="0"
          />
          {/* the side of the button, what shows when it is up */}
          <rect
            x="12"
            y="28"
            width="176"
            height="68"
            rx="12"
            fill="#2a1a14"
            stroke="currentColor"
          />
          <g ref={top}>
            <rect
              ref={plate}
              x="12"
              y="20"
              width="176"
              height="68"
              rx="12"
              fill="#101010"
              stroke="currentColor"
            />
            <text
              ref={text}
              x="100"
              y="66"
              textAnchor="middle"
              fill="currentColor"
              stroke="none"
              className="p-display"
              style={{
                fontSize: label.length > 8 ? 30 : 36,
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </text>
          </g>
          <g ref={hand} fill="#0a0a0a">
            <g className="p-hover" style={{ transformOrigin: "110px 150px" }}>
              {/* index finger up, three fingers folded to the right, thumb tucked on the left */}
              <path d="M80 107a11 11 0 0 1 22 0v29a9.7 9.7 0 0 1 19.4 0a9.7 9.7 0 0 1 19.4 0a9.7 9.7 0 0 1 19.4 0v26a24 24 0 0 1-24 24H98a22 22 0 0 1-22-22v-12c-10-2-16-8-14-16 2-6 8-8 16-4Z" />
              <path d="M121.4 136v12M140.8 136v12" />
              <path d="M78 140c-5 2-8 6-8 11" strokeWidth="4" />
            </g>
          </g>
        </svg>
      </div>
    );
  },
);

/* 05 · Where I work: a street signpost. The enamel plate is the home the artist is resident in; arrows point to the cities they visit. */
export const Signpost = forwardRef<
  ObjectHandle,
  { home: string; area: string | null; resident: string; guests: string[] }
>(function Signpost({ home, area, resident, guests }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const plate = useRef<SVGGElement>(null);
  const arrows = useRef<SVGGElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => gsap.set([root.current, plate.current, arrows.current], CLEAR),
    select: () =>
      new Promise((resolve) => {
        const el = root.current!;
        if (reduced()) return resolve(el.getBoundingClientRect());
        gsap
          .timeline({ onComplete: () => resolve(el.getBoundingClientRect()) })
          // the arrows swing on the post, the plate catches the light
          .to(arrows.current, { rotate: 8, duration: 0.18, ease: "power2.out", transformOrigin: "100px 40px" })
          .to(arrows.current, { rotate: 0, duration: 0.5, ease: "elastic.out(1.2, 0.35)" })
          .to(plate.current, { scale: 1.06, duration: 0.2, ease: "power2.out", transformOrigin: "100px 46px" }, "<")
          .to(el, { scale: 2.4, duration: 0.45, ease: "power3.in" }, ">-0.2");
      }),
  }));

  // Up to three arrows, one per city visited; with no guest spots the post holds only its home plate.
  const signs = guests.slice(0, 3).map((c) => c.toUpperCase());
  const homeName = (area || home).toUpperCase();
  const fit = (text: string, max: number, base: number) => Math.min(base, (max / Math.max(1, text.length)) * 1.9);

  return (
    <div ref={root} className="relative aspect-square w-full origin-center will-change-transform">
      <svg viewBox="0 0 200 200" className="p-float h-full w-full overflow-visible" aria-hidden>
        {/* the post and its shadow on the floor */}
        <ellipse cx="100" cy="192" rx="34" ry="5" fill="rgb(0 0 0 / 0.55)" />
        <rect x="96" y="10" width="8" height="182" rx="2" fill="#2a2724" stroke="var(--color-bone)" strokeOpacity="0.35" />
        <circle cx="100" cy="10" r="6" fill="#2a2724" stroke="var(--color-bone)" strokeOpacity="0.35" />

        {/* home: the enamel city plate, bone on black with a double rule */}
        <g ref={plate}>
          <rect x="18" y="22" width="164" height="50" rx="6" fill="var(--color-bone)" />
          <rect x="23" y="27" width="154" height="40" rx="3" fill="none" stroke="#0a0a0a" strokeWidth="1.5" />
          <text x="100" y="51" textAnchor="middle" fill="#0a0a0a" className="p-display" style={{ fontSize: fit(homeName, 140, 24) }}>
            {homeName}
          </text>
          <text x="100" y="62" textAnchor="middle" fill="#0a0a0a" className="p-stamp" style={{ fontSize: 6, letterSpacing: "0.3em" }}>
            {`★ ${resident.toUpperCase()}${area ? ` · ${home.toUpperCase()}` : ""}`}
          </text>
        </g>

        {/* the cities they visit: arrows alternating left and right down the post */}
        <g ref={arrows}>
          {signs.map((city, i) => {
            const y = 86 + i * 30;
            const right = i % 2 === 0;
            const d = right ? `M104 ${y}h62l12 11l-12 11h-62z` : `M96 ${y}h-62l-12 11l12 11h62z`;
            return (
              <g key={city + i}>
                <path d={d} fill="var(--accent)" stroke="var(--accent)" strokeWidth="2" />
                <text
                  x={right ? 138 : 62}
                  y={y + 15}
                  textAnchor="middle"
                  fill="#0a0a0a"
                  className="p-display"
                  style={{ fontSize: fit(city, 64, 13) }}
                >
                  {city}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
});

/* 01 · The artist: the cover of their digital magazine, on a screen of glass. Chosen, it lifts and catches the light; the reader then grows it to full size. */
export const Portrait = forwardRef<ObjectHandle, { children: React.ReactNode }>(
  function Portrait({ children }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const idle = useRef<HTMLDivElement>(null);
    const issue = useRef<HTMLDivElement>(null);
    const flash = useRef<HTMLDivElement>(null);
    const tab = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        gsap.set([root.current, flash.current, tab.current, issue.current], CLEAR);
        gsap.set(idle.current, { clearProps: "animationPlayState,transform" });
      },
      select: () =>
        new Promise((resolve) => {
          const box = issue.current!;
          if (reduced()) return resolve(box.getBoundingClientRect());
          gsap.set(idle.current, { animationPlayState: "paused" });
          gsap
            .timeline({ onComplete: () => resolve(box.getBoundingClientRect()) })
            // the cover straightens and comes up to you
            .to(idle.current, { rotateY: 0, rotateX: 0, y: 0, duration: 0.35, ease: "power2.out" })
            .to(root.current, { y: -10, scale: 1.05, duration: 0.35, ease: "power2.out" }, "<")
            .to(tab.current, { opacity: 0, duration: 0.2 }, "<")
            // one pass of light across the glass
            .fromTo(flash.current, { xPercent: -140, opacity: 1 }, { xPercent: 240, duration: 0.45, ease: "power1.inOut" }, "<0.1")
            .to(flash.current, { opacity: 0, duration: 0.15 }, ">-0.1");
        }),
    }));

    return (
      <div ref={root} className="relative mx-auto w-[68%] origin-center will-change-transform" style={{ perspective: "900px" }}>
        <div ref={idle} className="p-cover-idle relative aspect-[2/3] w-full" style={{ transformStyle: "preserve-3d" }}>
          {/* the earlier issues underneath */}
          {[2, 1].map((k) => (
            <div
              key={k}
              aria-hidden
              className="absolute inset-0 rounded-[6px] bg-ink-2"
              style={{
                transform: `translate3d(${k * 4}px, ${k * 5}px, ${-k * 7}px)`,
                boxShadow: "inset 0 0 0 1px rgb(244 237 224 / 0.2), 0 14px 30px -12px rgb(0 0 0 / 0.9)",
                opacity: 1 - k * 0.22,
              }}
            />
          ))}
          <div
            ref={issue}
            className="absolute inset-0 overflow-hidden rounded-[6px] bg-ink"
            style={{ boxShadow: "0 0 0 1px rgb(255 255 255 / 0.1), 0 30px 60px -18px rgb(0 0 0 / 0.95)" }}
          >
            <div className="pointer-events-none absolute inset-0">{children}</div>
            {/* the glass: a thin bright edge, a soft specular, the sheen that sweeps */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[6px]"
              style={{
                boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.45)",
                background: "radial-gradient(ellipse 70% 45% at 18% 0%, rgb(255 255 255 / 0.12), transparent 70%)",
              }}
            />
            <div aria-hidden className="p-screen absolute inset-0" />
            <div
              ref={flash}
              aria-hidden
              className="absolute inset-y-0 left-0 w-[60%] opacity-0"
              style={{ background: "linear-gradient(105deg, transparent 20%, rgb(255 255 255 / 0.55) 50%, transparent 80%)", mixBlendMode: "screen" }}
            />
          </div>
        </div>
        {/* the issue tab, below the cover and never on it */}
        <div ref={tab} className="mt-2.5 flex items-center justify-center gap-1.5">
          <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
          <span className="p-stamp text-[0.5rem] text-bone-dim">{BRAND.name} · Vol. 01</span>
        </div>
      </div>
    );
  },
);
