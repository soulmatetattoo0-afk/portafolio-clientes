"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { Tile } from "@/lib/layout";

/**
 * The editorial front (oct 2026): numbered sections on black, each a photo
 * with a condensed title and a spaced caption, the reserve button as a band in
 * the artist's colour. Sizes are in cqw of the front so the editor's small
 * phone frame shows the same page.
 */

const Arrow = ({ className = "h-[45%] w-[45%]" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);

/** "01 ——": the section's number, as in a magazine's contents. */
export function EdNumber({ n, tone = "bone" }: { n: number; tone?: "bone" | "ink" }) {
  return (
    <span className={`flex items-center gap-[2.4cqw] text-[max(0.62rem,2.6cqw)] font-medium tracking-[0.12em] ${tone === "bone" ? "text-bone/85" : "text-ink/80"}`}>
      {String(n).padStart(2, "0")}
      <span className={`h-px w-[9cqw] ${tone === "bone" ? "bg-bone/70" : "bg-ink/70"}`} />
    </span>
  );
}

/** The condensed title; big tiles get the big face, small ones scale down. */
const titleSize = (t: Tile, long: boolean) =>
  t.w === 2 && t.h >= 2 ? "text-[clamp(2.6rem,17cqw,4.8rem)]" : t.w === 2 ? "text-[clamp(2.2rem,14.5cqw,4.4rem)]" : t.h >= 2 ? (long ? "text-[clamp(1.7rem,11cqw,3.2rem)]" : "text-[clamp(1.9rem,13cqw,3.6rem)]") : "text-[clamp(1.4rem,8.5cqw,2.4rem)]";

/** The spaced caption under a title: "TATUAJES QUE HABITAN LA NATURALEZA." */
export function EdCaption({ text, tone = "bone", className = "" }: { text: string; tone?: "bone" | "ink"; className?: string }) {
  return <p className={`max-w-[34ch] text-[max(0.58rem,2.55cqw)] font-medium uppercase leading-[1.55] tracking-[0.32em] ${tone === "bone" ? "text-bone/90" : "text-ink/85"} ${className}`}>{text}</p>;
}

/** A photo section: the picture full bleed, darkened toward the words. */
export function EdTile({ n, title, caption, image, tile, onClick, icon }: { n: number; title: string; caption: string; image: string | null; tile: Tile; onClick: (e: React.MouseEvent<HTMLElement>) => void; icon?: React.ReactNode }) {
  const big = tile.w === 2 && tile.h >= 2;
  return (
    <button type="button" onClick={onClick} className="ed-tile text-left">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: big
            ? "linear-gradient(90deg, rgb(10 10 10 / 0.82) 0%, rgb(10 10 10 / 0.45) 45%, rgb(10 10 10 / 0.05) 80%), linear-gradient(0deg, rgb(10 10 10 / 0.5), transparent 40%)"
            : "linear-gradient(180deg, rgb(10 10 10 / 0.78) 0%, rgb(10 10 10 / 0.35) 55%, rgb(10 10 10 / 0.15) 100%)",
        }}
      />
      {icon && <span className="absolute right-[4.5cqw] top-[4.5cqw] text-bone">{icon}</span>}
      <div className="relative flex h-full flex-col p-[5.5cqw] pb-[5cqw]">
        <EdNumber n={n} />
        <h2 className={`p-display mt-[1.6cqw] ${titleSize(tile, title.length > 6)} uppercase leading-[0.84] text-bone`}>{title}</h2>
        <EdCaption text={caption} className="mt-[2.2cqw] max-w-[22ch]" />
        <span className={`mt-auto inline-flex shrink-0 items-center justify-center rounded-full text-bone ${big ? "h-[17cqw] w-[17cqw]" : "h-[13cqw] w-[13cqw]"}`} style={{ background: "var(--accent)" }}>
          <Arrow />
        </span>
      </div>
    </button>
  );
}

/** Dates: a sheet of this month on paper, tilted on the table, the next free day circled in the accent. */
export function EdDates({ n, title, caption, month, tile, onClick }: { n: number; title: string; caption: string; month: { label: string; offset: number; today: number; days: boolean[] }; tile: Tile; onClick: (e: React.MouseEvent<HTMLElement>) => void }) {
  const next = month.days.findIndex((free) => free) + 1;
  return (
    <button type="button" onClick={onClick} className="ed-tile text-left" style={{ background: "radial-gradient(120% 90% at 85% 100%, #2a2420, #121010 70%)" }}>
      <div
        aria-hidden
        className="absolute bottom-[-13%] right-[-16%] w-[100%] rounded-[6px] bg-[#ece4d4] p-[4%] shadow-[0_30px_40px_-10px_rgb(0_0_0/0.8)]"
        style={{ transform: "perspective(520px) rotateX(34deg) rotateZ(-14deg)", transformOrigin: "60% 100%" }}
      >
        <p className="mb-[3%] font-serif text-[max(0.55rem,3cqw)] italic text-[#2b2420]/70">{month.label}</p>
        <div className="grid grid-cols-7 gap-px bg-[#2b2420]/15">
          {Array.from({ length: month.offset }).map((_, i) => (
            <span key={`o${i}`} className="aspect-square bg-[#ece4d4]" />
          ))}
          {month.days.map((free, i) => (
            <span key={i} className="relative grid aspect-square place-items-center bg-[#ece4d4] text-[max(0.48rem,2.6cqw)] font-medium text-[#2b2420]" style={{ opacity: free || i + 1 === next ? 1 : 0.35 }}>
              {i + 1 === next ? <span className="h-[55%] w-[55%] rounded-full" style={{ background: "var(--accent)" }} /> : i + 1}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(10 10 10 / 0.7), rgb(10 10 10 / 0.05) 60%)" }} />
      <span className="absolute right-[4.5cqw] top-[4.5cqw] text-bone" aria-hidden>
        <svg className="h-[8cqw] w-[8cqw]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
          <circle cx="9" cy="15" r="0.9" fill="currentColor" />
          <circle cx="15" cy="15" r="0.9" fill="currentColor" />
        </svg>
      </span>
      <div className="relative flex h-full flex-col p-[5.5cqw]">
        <EdNumber n={n} />
        <h2 className={`p-display mt-[1.6cqw] ${titleSize(tile, title.length > 6)} uppercase leading-[0.84] text-bone`}>{title}</h2>
        <EdCaption text={caption} className="mt-[2.6cqw] max-w-[60%]" />
      </div>
    </button>
  );
}

/**
 * The reserve band: the artist's colour, the title in ink and a black disc
 * with the arrow. Pressed, it sinks for a beat, then opens the request.
 */
export function EdBook({ n, title, caption, stamp, tile, href, onPress, art, open }: { n: number; title: string; caption: string; stamp: string; tile: Tile; href?: string; onPress?: () => void; art: string | null; open: boolean }) {
  const router = useRouter();
  const [down, setDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = () => {
    if (timer.current) return;
    setDown(true);
    if (href) router.prefetch(href);
    timer.current = setTimeout(() => {
      timer.current = null;
      setDown(false);
      if (href) router.push(href);
      else onPress?.();
    }, 240);
  };
  return (
    <button type="button" onClick={press} data-down={down} aria-label={`${title}. ${caption}`} className={`ed-tile ed-book text-left ${open ? "" : "ed-book-closed"}`}>
      {art && (
        // The artist's own piece, printed in ink on the colour like an engraving.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" aria-hidden className="ed-book-art absolute inset-y-0 right-0 h-full w-[62%] object-cover" />
      )}
      <div className="relative flex h-full items-center justify-between gap-3 px-[5.5cqw] py-[3.2cqw]">
        <div className="flex min-w-0 flex-col justify-center">
          <span className="flex items-center gap-[3cqw]">
            <EdNumber n={n} tone={open ? "ink" : "bone"} />
            <span className={`truncate text-[max(0.55rem,2.3cqw)] font-semibold uppercase tracking-[0.3em] ${open ? "text-ink/80" : "text-accent"}`}>{stamp}</span>
          </span>
          <h2 className={`p-display mt-[1.4cqw] ${tile.h >= 2 ? titleSize(tile, false) : "text-[clamp(2rem,12.5cqw,3.8rem)]"} uppercase leading-[0.82] ${open ? "text-ink" : "text-bone"}`}>{title}</h2>
          <EdCaption text={caption} tone={open ? "ink" : "bone"} className="mt-[1.4cqw] truncate" />
        </div>
        <span className={`inline-flex h-[15cqw] w-[15cqw] shrink-0 items-center justify-center rounded-full ${open ? "bg-ink text-bone" : "text-bone"}`} style={open ? undefined : { background: "var(--accent)" }}>
          <Arrow />
        </span>
      </div>
    </button>
  );
}
