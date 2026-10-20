"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { placeTiles, type Tile, type TileKind } from "@/lib/layout";

/**
 * A front: one phone screen, nothing to scroll, the owner's buttons over the
 * blurred cover. Each button is a title and a picture; the grid places them
 * in the order and sizes the owner chose (see lib/layout).
 */
export function Front({
  accent,
  backdrop,
  nav,
  tiles,
  render,
  header,
  look = "cover",
  className = "h-svh",
}: {
  accent: string;
  backdrop: string | null;
  nav: React.ReactNode;
  tiles: Tile[];
  render: (tile: Tile, index: number) => React.ReactNode;
  /** Who this is (portrait, name, city), between the bar and the buttons. */
  header?: React.ReactNode;
  /** "cover": the buttons float over the blurred cover. "editorial": plain black paper. */
  look?: "cover" | "editorial";
  /** The editor shows the front inside a phone frame instead of the whole screen. */
  className?: string;
}) {
  const { rows, spots } = placeTiles(tiles);
  return (
    <div className={`poster relative overflow-hidden ${className}`} style={{ ["--accent" as string]: accent }}>
      <div className="absolute inset-0" aria-hidden style={look === "editorial" ? { background: "#0b0a09" } : undefined}>
        {look === "cover" && backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="animate-kenburns h-full w-full object-cover" style={{ filter: "blur(32px) saturate(0.55) brightness(0.5)", scale: "1.15" }} />
        )}
        {look === "cover" && (
          <>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(10 10 10 / 0.3), color-mix(in oklab, var(--accent) 10%, #0a0a0a) 92%)" }} />
            <div className="animate-glow absolute inset-0 mix-blend-screen" style={{ background: "radial-gradient(38% 28% at 16% 6%, color-mix(in oklab, var(--accent) 14%, #f3ebd9), transparent 70%)" }} />
          </>
        )}
        <div className="p-grain" />
      </div>
      <div className="p-front relative mx-auto h-full w-full max-w-[440px]" style={{ height: "100%", gridTemplateRows: `44px ${header ? "auto " : ""}repeat(${rows}, minmax(0, 1fr))` }}>
        <div className="flex items-center justify-between" style={{ gridColumn: "1 / span 2", gridRow: "1" }} data-rise>
          {nav}
        </div>
        {header && (
          <div className="min-w-0" style={{ gridColumn: "1 / span 2", gridRow: "2" }} data-rise>
            {header}
          </div>
        )}
        {tiles.map((t, i) => (
          <div key={t.kind} className="min-h-0 min-w-0" style={{ gridColumn: `${spots[i].col} / span ${t.w}`, gridRow: `${spots[i].row + (header ? 2 : 1)} / span ${t.h}`, ["--i" as string]: i + 1 }} data-rise>
            {render(t, i)}
          </div>
        ))}
      </div>
    </div>
  );
}

const Arrow = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** A title at the foot of a tile and the arrow that says it opens. Small tiles keep the arrow in the corner. */
export function Label({ title, tone = "bone", size = "md", flow = false }: { title: string; tone?: "bone" | "ink"; size?: "sm" | "md" | "lg"; flow?: boolean }) {
  const color = tone === "bone" ? "text-bone" : "text-ink";
  const face = size === "lg" ? "text-[clamp(2.6rem,13.5cqw,4.6rem)]" : size === "sm" ? "text-[clamp(1.25rem,6cqw,1.9rem)]" : "text-[clamp(1.5rem,7.2cqw,2.3rem)]";
  const ring = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${tone === "bone" ? "border-bone/50" : "border-ink/30"}`;
  return (
    <>
      {size === "sm" && (
        <span className={`${ring} absolute right-3 top-3 ${color}`}>
          <Arrow />
        </span>
      )}
      <div className={`${flow ? "relative mt-2" : "absolute inset-x-0 bottom-0 p-3.5"} flex items-end justify-between gap-2 ${color}`}>
        <div className={`p-display ${face} min-w-0 leading-[0.86]`}>{title}</div>
        {size !== "sm" && (
          <span className={ring}>
            <Arrow />
          </span>
        )}
      </div>
    </>
  );
}

/** How big a tile's title should be for its size on the grid. */
export const labelSize = (t: Tile): "sm" | "md" | "lg" => (t.w === 2 && t.h >= 2 ? "lg" : t.w === 1 && t.h === 1 ? "sm" : "md");

/** A picture tile: one image or a mosaic of up to four, a title at the foot. */
export function PhotoTile({ images, title, onClick, tile, stamp }: { images: string[]; title: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; tile: Tile; stamp?: string }) {
  const mosaic = images.length > 1;
  return (
    <button type="button" onClick={onClick} className="p-tile bg-ink text-left">
      <div className={`absolute inset-0 ${mosaic ? "grid grid-cols-2 gap-[2px]" : ""}`}>
        {images.slice(0, mosaic ? 4 : 1).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url + i} src={url} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(10 10 10 / 0.8), rgb(10 10 10 / 0.12) 55%, transparent)" }} />
      <div className="p-halftone" />
      {stamp && <div className="p-stamp absolute left-3.5 top-3.5 max-w-[70%] truncate text-[0.55rem] text-bone/85">{stamp}</div>}
      <Label title={title} size={labelSize(tile)} />
    </button>
  );
}

/** The month as dots on paper: free days solid, taken or past days a faint ring, today in the accent. */
export function MonthTile({ month, title, onClick, tile }: { month: { label: string; offset: number; today: number; days: boolean[] }; title: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; tile: Tile }) {
  return (
    <button type="button" onClick={onClick} className="p-tile p-card !flex flex-col !rounded-[24px] !p-3.5 text-left">
      <div className="p-grain" />
      <div className="p-stamp text-[0.52rem]" style={{ color: "var(--paper-ink-2)" }}>
        {month.label}
      </div>
      <div className="mt-2 flex min-h-0 flex-1 items-start">
        <div className="grid h-full max-w-full grid-cols-7 grid-rows-6 gap-[4px]" style={{ aspectRatio: "7 / 6" }} aria-hidden>
          {Array.from({ length: month.offset }).map((_, i) => (
            <span key={`o${i}`} />
          ))}
          {month.days.map((free, i) => (
            <span
              key={i}
              className="h-full w-full scale-[0.8] rounded-full"
              style={i + 1 === month.today ? { background: "var(--accent)" } : free ? { background: "var(--paper-ink)" } : { boxShadow: "inset 0 0 0 1.5px rgb(43 36 32 / 0.22)" }}
            />
          ))}
        </div>
      </div>
      <Label title={title} tone="ink" size={labelSize(tile)} flow />
    </button>
  );
}

/** The red keycap: pressed, it sinks for a beat, then opens where it leads (a page, or a handler). */
export function ReserveKey({ label, hint, href, onPress, tile }: { label: string; hint: string; href?: string | null; onPress?: (e: React.MouseEvent<HTMLElement>) => void; tile: Tile }) {
  const router = useRouter();
  const [down, setDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (timer.current) return;
    setDown(true);
    if (href) router.prefetch(href);
    const target = e.currentTarget;
    timer.current = setTimeout(() => {
      timer.current = null;
      setDown(false);
      if (href) router.push(href);
      else onPress?.({ currentTarget: target } as unknown as React.MouseEvent<HTMLElement>);
    }, 260);
  };
  const big = tile.h >= 2 || tile.w === 2;
  return (
    <button type="button" onClick={press} className="p-key" data-down={down} aria-label={`${label}. ${hint}`}>
      <span className="p-key-side" aria-hidden />
      <span className="p-key-cap" aria-hidden>
        <span className={`p-key-word p-display px-2 text-center ${big ? "text-[clamp(1.9rem,10.5cqw,3.3rem)]" : "text-[clamp(1.3rem,7cqw,2rem)]"} leading-[0.9]`}>{label}</span>
        <svg className="absolute bottom-5 right-5 h-7 w-7 drop-shadow-[0_2px_2px_rgb(0_0_0/0.5)]" viewBox="0 0 24 24" fill="#fff" stroke="#0a0a0a" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M5 3l14 9-6 1.5L9.5 20z" />
        </svg>
      </span>
    </button>
  );
}

/** This month as a sheet of days, free or not at the home studio. */
export function monthSheet(busy: Set<string>, locale: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const daysIn = new Date(y, m + 1, 0).getDate();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = now.getDate();
  return {
    label: new Intl.DateTimeFormat(locale, { month: "long" }).format(first),
    offset: (first.getDay() + 6) % 7,
    today,
    days: Array.from({ length: daysIn }, (_, i) => i + 1 >= today && !busy.has(iso(new Date(y, m, i + 1)))),
  };
}

export type { Tile, TileKind };
