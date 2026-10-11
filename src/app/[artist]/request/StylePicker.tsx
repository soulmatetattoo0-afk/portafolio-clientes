"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

type Color = "black_grey" | "color" | "undecided";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "What style are you after?": only the styles this artist works and takes
 * requests for, each shown with one of their own pieces in that style. A
 * tap brings the chosen one forward; then black and grey or colour, and
 * that answer moves the brief on.
 */
export function StylePicker({
  styles,
  value,
  color,
  onPick,
  onColor,
  labels,
}: {
  styles: { slug: string; label: string; image: string | null }[];
  value: string | null;
  color: Color | null;
  onPick: (slug: string | null) => void;
  onColor: (c: Color) => void;
  labels: { title: string; lead: string; chosen: string; colors: Record<Color, string>; colorTitle: string; change: string };
}) {
  const [picked, setPicked] = useState<string | null>(value);
  const grid = useRef<HTMLUListElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const chosen = styles.find((s) => s.slug === picked) ?? null;

  // The tiles arrive one after another.
  useEffect(() => {
    if (!grid.current || reduced()) return;
    const tiles = grid.current.querySelectorAll("li");
    gsap.fromTo(tiles, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.06 });
  }, []);

  // The chosen style comes forward, the colour question rises under it.
  useEffect(() => {
    if (!picked || !card.current || reduced()) return;
    gsap.fromTo(card.current, { opacity: 0, y: 24, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" });
  }, [picked]);

  return (
    <div className="grid gap-6">
      <header className="text-center">
        <h2 className="p-display text-[clamp(2.4rem,11vw,4.5rem)] leading-[0.9]">{labels.title}</h2>
        <p className="mx-auto mt-2 max-w-[40ch] text-[0.95rem] text-bone-dim">{labels.lead}</p>
      </header>

      {chosen ? (
        <div ref={card} className="mx-auto grid w-full max-w-md gap-4 text-center">
          <div className="relative mx-auto aspect-[4/5] w-[min(70vw,18rem)] overflow-hidden rounded-[18px] border border-accent/60 shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9)]">
            {chosen.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chosen.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="mag-stripes absolute inset-0 opacity-30" />
            )}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
            <span className="absolute inset-x-3 bottom-3 text-left">
              <span className="p-stamp block text-bone/70">{labels.chosen}</span>
              <span className="p-display block text-[2.2rem] leading-[0.9] text-accent">{chosen.label}</span>
            </span>
          </div>
          <p className="text-[1rem] text-bone/90">{labels.colorTitle}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={labels.colorTitle}>
            {(["black_grey", "color", "undecided"] as Color[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} className="chip justify-center px-2 text-[0.85rem]" onClick={() => onColor(c)}>
                {labels.colors[c]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mx-auto text-[0.85rem] text-bone-dim underline underline-offset-4"
            onClick={() => {
              setPicked(null);
              onPick(null);
            }}
          >
            {labels.change}
          </button>
        </div>
      ) : (
        <ul ref={grid} className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={labels.title}>
          {styles.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                role="radio"
                aria-checked={value === s.slug}
                onClick={() => {
                  setPicked(s.slug);
                  onPick(s.slug);
                }}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[16px] border border-line text-left transition hover:border-bone/60 focus-visible:border-accent"
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale-[35%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0" />
                ) : (
                  <span className="mag-stripes absolute inset-0 opacity-25" />
                )}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <span className="p-display absolute inset-x-3 bottom-3 text-[clamp(1.4rem,6.5vw,2rem)] leading-[0.9] text-bone">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
