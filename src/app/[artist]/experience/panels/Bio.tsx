"use client";

import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { fill } from "@/i18n";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { money } from "@/lib/format";
import type { PortfolioItem } from "@/lib/queries";
import { PLACEMENT_BY_SLUG, ZONE_BY_SLUG } from "@/mannequin/catalog";

import { coverWordOf, type ExperienceData } from "../types";

/**
 * The artist's own magazine, the one that lies on the studio table. It fills
 * the screen and is leafed through sideways: each page turns on the spine
 * with light and shadow, like paper. On a phone one page at a time; on a
 * wide screen the open spread, two pages side by side.
 */
export function Bio({ data }: { data: ExperienceData }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const p = a.panel.bio;
  const m = p.mag;
  const word = coverWordOf(artist, a.deck.cards.bio.title);
  const styles = artist.styles.map((s) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s);
  const paragraphs = (artist.bio ?? "").split(/\n{2,}/).filter(Boolean);
  const featured = data.portfolio.filter((i) => i.featured);
  const rest = data.portfolio.filter((i) => !i.featured);
  const year = new Date().getFullYear();
  const head = `${word} · ${m.vol} 01`;
  const place = (slug: string) => (PLACEMENT_BY_SLUG.get(slug) ?? ZONE_BY_SLUG.get(slug))?.label[locale] ?? slug;

  const pages: React.ReactNode[] = [];
  let n = 0;
  const folio = () => String(++n).padStart(2, "0");

  // Cover: the poster is the cover.
  pages.push(
    <Ink key="cover">
      {artist.portrait_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artist.portrait_url} alt="" draggable={false} className={`absolute inset-0 h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
      ) : (
        <div className="mag-stripes absolute inset-0 opacity-50" />
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/90 to-transparent" />
      {!artist.cover_poster && <p className="p-display absolute top-[9%] left-[6%] text-[22cqw] leading-[0.85] text-accent">{word}</p>}
      <div className="absolute inset-x-[6%] top-[4%] flex justify-between text-[2.6cqw] text-bone/85">
        <span className="mag-label text-bone/85">{m.issue}</span>
        <span className="mag-label text-bone/85">{year}</span>
      </div>
      <span aria-hidden className="mag-label absolute top-[40%] -right-[1%] origin-right rotate-90 text-bone/85">
        {m.vol} 01
      </span>
      <div className="absolute inset-x-[6%] bottom-[5%] flex items-end justify-between gap-4">
        <div>
          <p className="p-display text-[7cqw] leading-none">{artist.display_name}</p>
          {artist.home_city && <p className="mag-label mt-[1cqw] text-bone/80">{fill(a.basedIn, { city: artist.home_city })}</p>}
        </div>
        <span aria-hidden className="mag-stripes-bone h-[7cqw] w-[11cqw]" />
      </div>
    </Ink>,
  );

  // 01 Welcome.
  pages.push(
    <Paper key="welcome" head={head} folio={folio()}>
      <Numeral n="01" />
      <h3 className="mag-h mt-[8cqw]">{m.welcome}</h3>
      <p className="mag-kicker mt-[2cqw]">{m.welcomeLead}</p>
      <p className="mag-body mt-[4cqw] max-w-[40ch]">{artist.headline ?? ""}</p>
      {paragraphs[0] && <p className="mag-body mt-[3cqw] max-w-[44ch] text-ink/75">{paragraphs[0]}</p>}
      {artist.cover_quote && <p className="p-quote absolute inset-x-[8%] bottom-[9%] text-[5.2cqw] leading-[1.15] text-ink/85">“{artist.cover_quote}”</p>}
    </Paper>,
  );

  // 02 Contents.
  pages.push(
    <Paper key="contents" head={head} folio={folio()}>
      <Numeral n="02" right />
      <span className="mag-side absolute top-[24%] left-[6%]">{m.contents}</span>
      <ol className="absolute top-[24%] right-[8%] left-[18%] grid gap-[2.6cqw] border-l border-ink/15 pl-[5cqw]">
        <Toc n="01">{m.welcome}</Toc>
        <Toc n="02">{m.contents}</Toc>
        <Toc n="03">{m.artist}</Toc>
        {featured.map((f, i) => (
          <Toc key={f.id} n={String(i + 4).padStart(2, "0")}>
            {f.title ?? m.work}
          </Toc>
        ))}
        <Toc n={String(featured.length + 4).padStart(2, "0")}>{m.thanks}</Toc>
      </ol>
      <span aria-hidden className="mag-stripes absolute bottom-[8%] left-[8%] h-[10cqw] w-[18cqw]" />
    </Paper>,
  );

  // 03 The artist: the words, then the portrait with the facts.
  pages.push(
    <Paper key="artist" head={head} folio={folio()}>
      <Numeral n="03" right />
      <h3 className="mag-h max-w-[62%]">{artist.display_name}</h3>
      {artist.headline && <p className="mag-kicker mt-[1.5cqw]">{artist.headline}</p>}
      <div className="mag-body mt-[5cqw] max-w-[46ch]">
        {paragraphs.length ? paragraphs.map((para, i) => <p key={i} className={i ? "mt-[3cqw]" : ""}>{para}</p>) : <p className="text-ink/60">{p.noBio}</p>}
      </div>
    </Paper>,
  );
  pages.push(
    <Paper key="artist-2" head={head} folio={folio()}>
      <div className="absolute top-[14%] left-[8%] h-[46%] w-[46%] border-[0.8cqw] border-accent">
        {artist.portrait_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.portrait_url} alt={artist.display_name} draggable={false} className={`h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
        ) : (
          <div className="mag-stripes h-full w-full opacity-40" />
        )}
      </div>
      <span aria-hidden className="mag-stripes absolute top-[9%] left-[42%] h-[10cqw] w-[14cqw]" />
      <dl className="absolute top-[14%] right-[8%] left-[60%] grid gap-[3cqw]">
        {artist.home_city && <Spec label={p.based}>{artist.home_city}</Spec>}
        {artist.since_year && <Spec label={p.since}>{artist.since_year}</Spec>}
        {artist.min_price_cents ? <Spec label={p.starting}>{money(artist.min_price_cents, artist.currency, locale)}</Spec> : null}
      </dl>
      {styles.length > 0 && (
        <div className="absolute right-[8%] bottom-[9%] left-[8%] border-t-[0.4cqw] border-ink pt-[3cqw]">
          <p className="mag-label">{p.styles}</p>
          <ul className="mt-[2cqw] grid grid-cols-2 gap-x-[6cqw] gap-y-[2.2cqw]">
            {styles.map((s, i) => (
              <li key={s} className="text-[3.3cqw]">
                <span className="block">{s}</span>
                <span aria-hidden className="mt-[1cqw] block h-[0.5cqw] bg-ink/15">
                  <span className="block h-full bg-accent" style={{ width: `${88 - i * 14}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Paper>,
  );

  // The pieces: words on one page, the piece on the next; a collage after every second piece.
  featured.forEach((piece, i) => {
    const num = String(i + 4).padStart(2, "0");
    const specs = (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-[4cqw] gap-y-[1cqw] text-[3.2cqw]">
        {piece.style && <Row label={m.style}>{STYLE_BY_SLUG.get(piece.style)?.label[locale] ?? piece.style}</Row>}
        {piece.placement && <Row label={m.placement}>{place(piece.placement)}</Row>}
        {piece.color_mode && <Row label={m.colour}>{piece.color_mode === "color" ? m.color : m.blackGrey}</Row>}
        <Row label={m.status}>{piece.is_healed ? m.healed : m.fresh}</Row>
      </dl>
    );
    const onAccent = i % 2 === 1;
    pages.push(
      onAccent ? (
        <Accent key={`${piece.id}-a`} head={head} folio={folio()}>
          <Numeral n={num} dark />
          <h3 className="mag-h mt-[6cqw] text-ink">{piece.title ?? m.work}</h3>
          <p className="mag-label mt-[6cqw] text-ink/70">{m.description}</p>
          <p className="mag-body mt-[1.5cqw] max-w-[40ch]">{piece.story ?? m.noStory}</p>
          <div className="absolute right-[8%] bottom-[9%] left-[8%]">{specs}</div>
        </Accent>
      ) : (
        <Paper key={`${piece.id}-a`} head={head} folio={folio()}>
          <Numeral n={num} />
          <h3 className="mag-h mt-[6cqw]">{piece.title ?? m.work}</h3>
          <p className="mag-label mt-[6cqw]">{m.description}</p>
          <p className="mag-body mt-[1.5cqw] max-w-[40ch]">{piece.story ?? m.noStory}</p>
          <div className="absolute right-[8%] bottom-[9%] left-[8%]">{specs}</div>
        </Paper>
      ),
    );
    pages.push(
      <Paper key={`${piece.id}-b`} head={head} folio={folio()} bleed>
        <span aria-hidden className="mag-stripes absolute top-[8%] right-[6%] h-[22cqw] w-[11cqw]" />
        <Art piece={piece} className="absolute top-[12%] right-[12%] bottom-[8%] left-[8%]" />
        <span className="mag-label absolute right-[6%] bottom-[3.5%] text-ink/60">{piece.title}</span>
      </Paper>,
    );
    if (i % 2 === 1 || i === featured.length - 1) {
      const slice = rest.slice(((i / 2) | 0) * 4, ((i / 2) | 0) * 4 + 4);
      if (slice.length)
        pages.push(
          <Paper key={`collage-${i}`} head={head} folio={folio()} bleed>
            <div className="absolute inset-x-[5%] top-[10%] bottom-[6%] grid grid-cols-2 grid-rows-2 gap-[1.5cqw]">
              {slice.map((piece, k) => (
                <Art key={piece.id} piece={piece} className={k === 0 && slice.length > 2 ? "row-span-2" : ""} />
              ))}
            </div>
          </Paper>,
        );
    }
  });

  if (!featured.length)
    pages.push(
      <Paper key="empty" head={head} folio={folio()}>
        <Numeral n="04" />
        <p className="mag-body mt-[6cqw] max-w-[40ch] text-ink/70">{m.empty}</p>
      </Paper>,
    );

  // Thanks.
  pages.push(
    <Ink key="thanks">
      <span aria-hidden className="absolute top-[8%] left-[8%] h-[16cqw] w-px bg-bone/40" />
      <p className="p-display absolute top-[16%] left-[8%] text-[20cqw] leading-[0.85]">{m.thanks.toUpperCase()}</p>
      {artist.cover_quote && <p className="p-quote absolute top-[42%] right-[8%] left-[8%] text-[6cqw] leading-[1.15] text-bone/90">“{artist.cover_quote}”</p>}
      <div className="absolute right-[8%] bottom-[6%] left-[8%] flex items-end justify-between gap-4 border-t border-bone/30 pt-[3cqw]">
        {artist.instagram ? (
          <a className="mag-label text-bone underline decoration-accent underline-offset-4" href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer">
            {m.scan} · @{artist.instagram}
          </a>
        ) : (
          <span className="mag-label text-bone">{artist.display_name}</span>
        )}
        <span className="mag-label text-bone/60">{head}</span>
      </div>
    </Ink>,
  );

  return <Book pages={pages} labels={{ page: m.page, next: a.panel.next, prev: a.panel.prev }} />;
}

/* ------------------------------------------------------------------ the book */

interface Leaf {
  front: React.ReactNode;
  back: React.ReactNode;
  left: React.ReactNode | null;
  right: React.ReactNode | null;
  from: number;
  to: number;
  next: number;
}

const RATIO = 0.72;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Book({ pages, labels }: { pages: React.ReactNode[]; labels: { page: string; next: string; prev: string } }) {
  const stage = useRef<HTMLDivElement>(null);
  const leafEl = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [p, setP] = useState(0);
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const turning = useRef(false);
  const drag = useRef({ x: 0, y: 0, t: 0 });

  // Fit the page (or the open spread) to the stage.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const two = W >= 700;
      const h = Math.min(H, (two ? W / 2 : W) / RATIO);
      setSpread(two);
      setSize({ w: Math.floor(h * RATIO), h: Math.floor(h) });
      setP((v) => (two ? v - (v % 2) : v));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const last = pages.length - 1;
  const canNext = spread ? p + 1 <= last : p < last;
  const canPrev = p > 0;

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (turning.current) return;
      if (dir > 0 && !canNext) return;
      if (dir < 0 && !canPrev) return;
      let next: Leaf;
      if (spread) {
        next =
          dir > 0
            ? { front: pages[p], back: pages[p + 1] ?? null, left: pages[p - 1] ?? null, right: pages[p + 2] ?? null, from: 0, to: -180, next: p + 2 }
            : { front: pages[p - 2] ?? null, back: pages[p - 1] ?? null, left: pages[p - 3] ?? null, right: pages[p], from: -180, to: 0, next: p - 2 };
      } else {
        next =
          dir > 0
            ? { front: pages[p], back: null, left: null, right: pages[p + 1], from: 0, to: -180, next: p + 1 }
            : { front: pages[p - 1], back: null, left: null, right: pages[p], from: -180, to: 0, next: p - 1 };
      }
      if (reduced()) {
        setP(next.next);
        return;
      }
      turning.current = true;
      setLeaf(next);
    },
    [canNext, canPrev, p, pages, spread],
  );

  // Once the leaf is in the DOM, swing it.
  useEffect(() => {
    if (!leaf || !leafEl.current) return;
    const el = leafEl.current;
    const stg = stage.current!;
    const state = { a: leaf.from };
    const paint = () => {
      el.style.transform = `rotateY(${state.a}deg)`;
      // 0 at rest, 1 edge-on: drives the shading on the leaf and the shadow it casts.
      const f = Math.sin((Math.abs(state.a) * Math.PI) / 180);
      stg.style.setProperty("--f", f.toFixed(3));
      stg.style.setProperty("--side", state.a < -90 ? "1" : "0");
    };
    paint();
    const tween = gsap.to(state, {
      a: leaf.to,
      duration: 0.9,
      ease: "power2.inOut",
      onUpdate: paint,
      onComplete: () => {
        setP(leaf.next);
        setLeaf(null);
        turning.current = false;
        stg.style.setProperty("--f", "0");
      },
    });
    return () => {
      tween.kill();
    };
  }, [leaf]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    // Keep the gesture on the stage even when the finger leaves it, and never let an image start a native drag.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return turn(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      // A tap near the outer edge turns the page.
      const r = stage.current!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x > 0.72) turn(1);
      else if (x < 0.28) turn(-1);
    }
  };

  const left = spread ? (leaf ? leaf.left : (pages[p - 1] ?? null)) : null;
  const right = leaf ? leaf.right : pages[p];
  const shown = spread ? (p === 0 ? "01" : `${String(p).padStart(2, "0")}–${String(Math.min(p + 1, last + 1)).padStart(2, "0")}`) : String(p + 1).padStart(2, "0");

  return (
    <div className="flex h-[calc(100dvh-4.2rem)] min-h-[520px] flex-col px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div
        ref={stage}
        className="mag-stage relative min-h-0 flex-1 touch-pan-y select-none"
        style={{ perspective: "2400px", perspectiveOrigin: "50% 50%" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
      >
        {size.w > 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: spread ? size.w * 2 : size.w, height: size.h }}>
            {spread && (
              <div className="mag-sheet mag-base absolute top-0 left-0 h-full overflow-hidden" style={{ width: size.w }}>
                {left ?? <div className="h-full w-full bg-[#141210]" />}
                <div aria-hidden className="mag-gutter-left absolute inset-0" />
              </div>
            )}
            <div className="mag-sheet mag-base absolute top-0 h-full overflow-hidden" style={{ left: spread ? size.w : 0, width: size.w }}>
              {right ?? <div className="h-full w-full bg-[#141210]" />}
              <div aria-hidden className="mag-gutter-right absolute inset-0" />
              <div aria-hidden className="mag-cast absolute inset-0" />
            </div>
            {leaf && (
              <div
                ref={leafEl}
                className="absolute top-0 z-10 h-full will-change-transform"
                style={{ left: spread ? size.w : 0, width: size.w, transformOrigin: "left center", transformStyle: "preserve-3d" }}
              >
                <div className="mag-sheet absolute inset-0 overflow-hidden [backface-visibility:hidden]">
                  {leaf.front}
                  <div aria-hidden className="mag-shade-front absolute inset-0" />
                </div>
                <div className="mag-sheet absolute inset-0 overflow-hidden [backface-visibility:hidden]" style={{ transform: "rotateY(180deg)" }}>
                  {leaf.back ?? <div className="h-full w-full bg-[#efece5]" />}
                  <div aria-hidden className="mag-shade-back absolute inset-0" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <button type="button" className="btn btn-ghost btn-sm text-bone disabled:opacity-25" onClick={() => turn(-1)} disabled={!canPrev} aria-label={labels.prev}>
          <span aria-hidden className="text-[1.2rem] leading-none">‹</span>
          <span className="p-stamp ml-1">{labels.prev}</span>
        </button>
        <span className="p-stamp text-bone-dim tabular-nums">
          {labels.page} {shown} / {String(pages.length).padStart(2, "0")}
        </span>
        <button type="button" className="btn btn-ghost btn-sm text-bone disabled:opacity-25" onClick={() => turn(1)} disabled={!canNext} aria-label={labels.next}>
          <span className="p-stamp mr-1">{labels.next}</span>
          <span aria-hidden className="text-[1.2rem] leading-none">›</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page kinds */

function Paper({ head, folio, bleed = false, children }: { head: string; folio: string; bleed?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full bg-[#f7f5f0] text-ink">
      <div className="absolute inset-x-[6%] top-[3.5%] flex items-center justify-between">
        <span className="mag-label">{head}</span>
        <span className="mag-label tabular-nums">{folio}</span>
      </div>
      <div className={bleed ? "absolute inset-0" : "absolute inset-x-[8%] top-[11%] bottom-[8%]"}>{children}</div>
    </div>
  );
}

function Accent({ head, folio, children }: { head: string; folio: string; children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full bg-accent text-ink">
      <div className="absolute inset-x-[6%] top-[3.5%] flex items-center justify-between">
        <span className="mag-label text-ink/70">{head}</span>
        <span className="mag-label text-ink/70 tabular-nums">{folio}</span>
      </div>
      <span aria-hidden className="mag-stripes-ink absolute top-[11%] right-[8%] h-[8cqw] w-[13cqw]" />
      <div className="absolute inset-x-[8%] top-[11%] bottom-[8%]">{children}</div>
    </div>
  );
}

function Ink({ children }: { children: React.ReactNode }) {
  return <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a] text-bone">{children}</div>;
}

/** The piece as printed: the photo, or a striped plate with its title until there is one. */
function Art({ piece, className = "" }: { piece: PortfolioItem; className?: string }) {
  return (
    <figure className={`relative min-h-0 overflow-hidden bg-[#e9e5dc] ${className}`}>
      {piece.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={piece.url} alt={piece.title ?? ""} className="h-full w-full object-cover" loading="lazy" draggable={false} />
      ) : (
        <div className="relative grid h-full w-full place-items-center p-[6cqw]">
          <span aria-hidden className="mag-stripes absolute inset-0 opacity-30" />
          <span className="p-quote relative max-w-[16ch] text-center text-[4.4cqw] leading-tight text-ink/80">{piece.title}</span>
        </div>
      )}
    </figure>
  );
}

function Numeral({ n, right = false, dark = false, className = "" }: { n: string; right?: boolean; dark?: boolean; className?: string }) {
  return (
    <span className={`relative inline-block ${right ? "float-right" : ""} ${className}`} aria-hidden>
      <span className={`${dark ? "mag-stripes-ink" : "mag-stripes"} absolute -top-[2cqw] -right-[5cqw] h-[14cqw] w-[14cqw]`} />
      <span className="p-display relative text-[22cqw] leading-[0.8]">{n}</span>
    </span>
  );
}

function Toc({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-[2.5cqw] text-[3.4cqw]">
      <span className="tabular-nums text-ink/50">{n}.</span>
      <span className="truncate">{children}</span>
    </li>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mag-label">{label}</dt>
      <dd className="mt-[0.8cqw] text-[3.6cqw] leading-tight">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mag-label self-center">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </>
  );
}
