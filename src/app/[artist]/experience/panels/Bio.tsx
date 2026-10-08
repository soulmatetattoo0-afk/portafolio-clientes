"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fill } from "@/i18n";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { money } from "@/lib/format";
import type { PortfolioItem } from "@/lib/queries";
import { PLACEMENT_BY_SLUG, ZONE_BY_SLUG } from "@/mannequin/catalog";

import { BRAND } from "@/lib/brand";

import type { ExperienceData } from "../types";

/**
 * The artist's digital magazine. Not paper: full-screen chapters that slide
 * sideways, each one a composition of type and photographs of different
 * sizes. Opening, the artist and the career, the pieces people ask for most
 * (one chapter each), the wide gallery in mosaics, and the sign-off.
 */
export function Bio({ data }: { data: ExperienceData }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const p = a.panel.bio;
  const m = p.mag;
  const styles = artist.styles.map((s) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s);
  const paragraphs = (artist.bio ?? "").split(/\n{2,}/).filter(Boolean);
  const featured = data.portfolio.filter((i) => i.featured);
  const year = new Date().getFullYear();
  const years = artist.since_year ? Math.max(1, year - artist.since_year) : null;
  const cities = Array.from(new Set(data.stops.map((s) => s.city)));
  const away = data.stops.filter((s) => !s.is_home);
  const home = data.stops.find((s) => s.is_home);
  const place = (slug: string) => (PLACEMENT_BY_SLUG.get(slug) ?? ZONE_BY_SLUG.get(slug))?.label[locale] ?? slug;
  const styleOf = (piece: PortfolioItem) => (piece.style ? (STYLE_BY_SLUG.get(piece.style)?.label[locale] ?? piece.style) : null);
  const [first, ...restName] = artist.display_name.split(" ");
  const portrait = artist.portrait_url ? { src: artist.portrait_url, grey: !artist.cover_poster } : null;

  const chapters: { key: string; label: string; node: React.ReactNode }[] = [];

  // The cover: the house masthead across the full width, the portrait in black and white,
  // facts as cover lines, the artist's name at the foot, the volume line, the RESERVE stamp.
  const coverLines = [
    styles.length ? styles.slice(0, 2).join(" · ") : null,
    home ? [home.studio_name, home.city].filter(Boolean).join(", ") : artist.home_city,
    cities.length && years ? `${cities.length} ${m.cities} · ${years} ${m.years}` : null,
    featured[0]?.title ? `${m.popular}: ${featured[0].title}` : null,
  ].filter((l): l is string => !!l);
  chapters.push({
    key: "cover",
    label: m.issue,
    node: (
      <Ch tone="ink">
        <div className="absolute inset-0 @3xl:left-1/2 @3xl:w-[62cqh] @3xl:-translate-x-1/2">
          <div className="absolute inset-0 overflow-hidden" data-img>
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait.src} alt={artist.display_name} draggable={false} className="block h-full w-full object-cover object-top grayscale-[.85] contrast-[1.08]" />
            ) : (
              <div className="mag-stripes absolute inset-0 opacity-30" />
            )}
            <div aria-hidden className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/92 via-black/50 to-transparent" />
          </div>
          {/* masthead: the name set to the full width of the cover */}
          <div className="absolute inset-x-[4cqw] top-[3cqw]">
            <svg data-r viewBox="0 0 100 26" className="block w-full" aria-label={BRAND.name} role="img">
              <text x="0" y="25" textLength="100" lengthAdjust="spacingAndGlyphs" fill="var(--color-bone)" style={{ fontFamily: "var(--font-poster)", fontWeight: 900, fontSize: 36, fontVariationSettings: '"opsz" 72', letterSpacing: "0.005em" }}>
                {BRAND.name}
              </text>
            </svg>
            <p data-r style={{ "--d": "90ms" } as React.CSSProperties} className="p-gothic mt-[0.5cqw] flex justify-between text-[clamp(0.95rem,3.2cqw,1.5rem)] text-bone/85">
              <span>{m.issue}</span>
              <span className="text-accent">{m.vol} 01</span>
            </p>
          </div>
          {/* cover lines: facts, each under a hairline in the artist's colour */}
          <ul className="absolute top-[42%] left-[4cqw] grid max-w-[46%] gap-[2.4cqw]">
            {coverLines.slice(0, 4).map((line, i) => (
              <li key={line} data-r style={{ "--d": `${200 + i * 80}ms` } as React.CSSProperties} className="border-t border-accent pt-[1.2cqw]">
                <span className="p-stamp block text-[clamp(0.6rem,2.6cqw,0.9rem)] leading-[1.25] text-bone">{line.toUpperCase()}</span>
              </li>
            ))}
          </ul>
          {/* RESERVE: the sign from the ring, stamped on the cover */}
          {artist.accepting && (
            <a
              href={`/${artist.slug}/request`}
              data-r
              style={{ "--d": "520ms" } as React.CSSProperties}
              className="p-display absolute bottom-[23%] left-[5cqw] -rotate-[8deg] border-2 border-accent px-[2.2cqw] py-[0.8cqw] text-[clamp(0.9rem,4cqw,1.9rem)] leading-none text-accent"
            >
              {a.deck.sign.toUpperCase()}
            </a>
          )}
          {/* the volume line and the name */}
          <div className="absolute right-[4cqw] bottom-[3cqw] left-[4cqw] flex items-end justify-between gap-[3cqw]">
            <p data-r style={{ "--d": "420ms" } as React.CSSProperties} className="p-stamp text-[clamp(0.55rem,2.2cqw,0.8rem)] leading-[1.6] text-bone/75">
              {BRAND.name} · {year}
              {artist.home_city ? <><br />{artist.home_city.toUpperCase()}</> : null}
            </p>
            <div className="min-w-0 text-right">
              <p data-r style={{ "--d": "300ms" } as React.CSSProperties} className="p-display text-[clamp(3rem,17cqw,9rem)] leading-[0.84] text-bone @3xl:text-[16cqw]">
                {first}
              </p>
              {restName.length > 0 && (
                <p data-r style={{ "--d": "360ms" } as React.CSSProperties} className="p-display text-[clamp(1.6rem,9cqw,4.6rem)] leading-[0.9] text-bone">
                  {restName.join(" ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </Ch>
    ),
  });

  // The artist and the career: words, facts, the line of years and cities, two photographs.
  chapters.push({
    key: "artist",
    label: m.artist,
    node: (
      <Ch tone="bone">
        <div className="absolute inset-0 grid grid-rows-[auto_1fr] gap-[3cqw] p-[5cqw] @3xl:grid-cols-[1.1fr_0.9fr] @3xl:grid-rows-1 @3xl:gap-[4cqw] @3xl:p-[4cqw]">
          <div className="min-w-0">
            <p data-r className="p-gothic text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">01 · {m.artist}</p>
            <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display mt-1 text-[clamp(2.4rem,11cqw,5.5rem)] text-ink @3xl:text-[7.5cqw]">
              {m.career}
            </h3>
            <p data-r style={{ "--d": "160ms" } as React.CSSProperties} className="p-col mt-[2cqw] line-clamp-4 max-w-[46ch] text-[clamp(1rem,2.5cqw,1.3rem)] text-ink/85 @3xl:line-clamp-none">
              {paragraphs.length ? paragraphs.join(" ") : p.noBio}
            </p>
            <ul data-r style={{ "--d": "240ms" } as React.CSSProperties} className="mt-[3cqw] grid grid-cols-3 gap-3 border-t border-ink/20 pt-[2.5cqw]">
              {years !== null && <Stat n={years} label={m.years} />}
              <Stat n={data.portfolio.length} label={m.pieces} />
              <Stat n={cities.length} label={m.cities} />
            </ul>
            <ol data-r style={{ "--d": "320ms" } as React.CSSProperties} className="mt-[3cqw] flex items-end gap-[3cqw] overflow-hidden whitespace-nowrap">
              {artist.since_year && <Stop year={String(artist.since_year)} label={m.started} first />}
              {home && <Stop year={m.home} label={home.city} />}
              {away.slice(0, 3).map((s) => (
                <Stop key={s.id} year={s.starts_on ? String(new Date(s.starts_on).getFullYear()) : year.toString()} label={s.city} />
              ))}
            </ol>
          </div>
          <div className="relative min-h-0">
            <Fig src={portrait?.src} grey duo title={artist.display_name} className="absolute top-0 right-0 h-[84%] w-[58%] @3xl:h-[90%] @3xl:w-[60%]" />
            {data.portfolio[1] && <Fig src={data.portfolio[1].url} title={data.portfolio[1].title ?? ""} caption={data.portfolio[1].title ?? undefined} delay="260ms" className="absolute bottom-0 left-0 h-[48%] w-[50%] ring-[0.6cqw] ring-bone" />}
            {styles.length > 0 && (
              <ul data-r style={{ "--d": "380ms" } as React.CSSProperties} className="absolute top-[2%] left-0 grid gap-1.5">
                {styles.map((s) => (
                  <li key={s} className="p-stamp w-fit bg-ink px-2.5 py-1.5 text-bone">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {artist.min_price_cents ? (
              <p data-r style={{ "--d": "440ms" } as React.CSSProperties} className="absolute right-0 bottom-[2%] bg-accent px-3 py-2 text-right text-ink">
                <span className="p-stamp block text-ink/70">{p.starting}</span>
                <span className="p-display block text-[clamp(1.4rem,4cqw,2.4rem)]">{money(artist.min_price_cents, artist.currency, locale)}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Ch>
    ),
  });

  // The pieces people ask for most: one chapter each, the photograph taking most of the screen.
  featured.forEach((piece, i) => {
    const num = String(i + 1).padStart(2, "0");
    const flip = i % 2 === 1;
    chapters.push({
      key: `pop-${piece.id}`,
      label: `${m.popular} ${num}`,
      node: (
        <Ch tone="ink">
          <div className="absolute inset-0 grid grid-rows-[56%_1fr] @3xl:grid-cols-[58%_1fr] @3xl:grid-rows-1">
            <Fig src={piece.url} title={piece.title ?? m.work} className={`relative h-full w-full ${flip ? "@3xl:order-2" : ""}`} />
            <div className={`relative z-10 flex min-h-0 flex-col justify-end px-[5cqw] pt-[6cqw] pb-[5cqw] @3xl:justify-center @3xl:p-[4cqw] ${flip ? "@3xl:order-1" : ""}`}>
              <span aria-hidden data-r className={`p-display pointer-events-none absolute top-0 -translate-y-1/2 text-[clamp(5rem,22cqw,9rem)] leading-none text-accent @3xl:top-[8%] @3xl:translate-y-0 @3xl:text-[14cqw] ${flip ? "right-[5cqw] @3xl:right-[-0.28em]" : "left-[5cqw] @3xl:left-[-0.28em]"}`}>
                {num}
              </span>
              <p data-r className="p-gothic text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">
                02 · {m.popular}
              </p>
              <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display mt-1 text-[clamp(1.9rem,8cqw,4.2rem)] text-bone @3xl:text-[5.4cqw]">
                {piece.title ?? m.work}
              </h3>
              <p data-r style={{ "--d": "160ms" } as React.CSSProperties} className="p-col mt-[1.5cqw] line-clamp-4 max-w-[40ch] text-[clamp(0.95rem,2.4cqw,1.25rem)] text-bone/85 @3xl:line-clamp-none">
                {piece.story ?? m.noStory}
              </p>
              <dl data-r style={{ "--d": "240ms" } as React.CSSProperties} className="p-stamp mt-[2.5cqw] flex flex-wrap gap-x-6 gap-y-1.5 border-t border-bone/20 pt-[2cqw] text-bone/60">
                {styleOf(piece) && <Fact label={m.style}>{styleOf(piece)}</Fact>}
                {piece.placement && <Fact label={m.placement}>{place(piece.placement)}</Fact>}
                {piece.color_mode && <Fact label={m.colour}>{piece.color_mode === "color" ? m.color : m.blackGrey}</Fact>}
                <Fact label={m.status}>{piece.is_healed ? m.healed : m.fresh}</Fact>
              </dl>
            </div>
          </div>
        </Ch>
      ),
    });
  });
  if (!featured.length)
    chapters.push({
      key: "pop-empty",
      label: m.popular,
      node: (
        <Ch tone="ink">
          <div className="absolute inset-0 flex flex-col justify-center p-[6cqw]">
            <p data-r className="p-gothic text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">02 · {m.popular}</p>
            <p data-r style={{ "--d": "100ms" } as React.CSSProperties} className="p-col mt-4 max-w-[40ch] text-bone/75">
              {m.empty}
            </p>
          </div>
        </Ch>
      ),
    });

  // The gallery: mosaics of five, every photograph a different size.
  const all = [...featured, ...data.portfolio.filter((i) => !i.featured)];
  for (let k = 0; k < all.length; k += 5) {
    const slice = all.slice(k, k + 5);
    const full = slice.length === 5;
    chapters.push({
      key: `gal-${k}`,
      label: m.gallery,
      node: (
        <Ch tone="bone">
          <div className="absolute inset-0 flex flex-col gap-[2cqw] p-[3cqw]">
            <p data-r className="p-gothic flex items-baseline justify-between text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">
              <span>03 · {m.gallery}</span>
              <span className="p-stamp text-ink/60">{fill(a.panel.work.count, { n: data.portfolio.length })}</span>
            </p>
            <div className={`grid min-h-0 flex-1 gap-[1.2cqw] ${full ? "grid-cols-3 grid-rows-4 @3xl:grid-cols-4 @3xl:grid-rows-3" : "grid-flow-dense grid-cols-3 grid-rows-2 @3xl:grid-cols-4"}`}>
              {slice.map((piece, j) => (
                <Fig key={piece.id} src={piece.url} title={piece.title ?? m.work} caption={piece.title ?? undefined} sub={styleOf(piece) ?? undefined} delay={`${j * 90}ms`} className={`min-h-0 ${full ? MOSAIC[j] : j === 0 ? "col-span-2 row-span-2" : ""}`} />
              ))}
            </div>
          </div>
        </Ch>
      ),
    });
  }

  // Sign-off on the artist's colour.
  chapters.push({
    key: "end",
    label: m.thanks,
    node: (
      <Ch tone="accent">
        <div className="absolute inset-0 flex flex-col justify-between p-[6cqw] @3xl:p-[5cqw]">
          <p data-r className="p-gothic text-[clamp(1rem,2.2cqw,1.5rem)] text-ink/70">
            {m.issue} · {m.vol} 01
          </p>
          <div>
            <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display text-[clamp(4rem,24cqw,13rem)] text-ink @3xl:text-[18cqw]">
              {m.thanks}
            </h3>
            {artist.cover_quote && (
              <p data-r style={{ "--d": "180ms" } as React.CSSProperties} className="p-quote mt-[2cqw] max-w-[28ch] text-[clamp(1.2rem,3.4cqw,2rem)] text-ink/85">
                “{artist.cover_quote}”
              </p>
            )}
            <p data-r style={{ "--d": "240ms" } as React.CSSProperties} className="p-stamp mt-[3cqw] max-w-[40ch] text-ink/70">
              {BRAND.editor[locale]} · {BRAND.name} {m.vol} 01{artist.home_city ? ` · ${artist.home_city}` : ""}
            </p>
          </div>
          <div data-r style={{ "--d": "260ms" } as React.CSSProperties} className="flex flex-wrap items-center justify-between gap-4 border-t border-ink/25 pt-[2.5cqw]">
            {artist.instagram ? (
              <a className="p-stamp text-ink underline decoration-ink/40 underline-offset-4" href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer">
                {m.scan} · @{artist.instagram}
              </a>
            ) : (
              <span className="p-stamp text-ink">{artist.display_name}</span>
            )}
            {artist.accepting && (
              <a href={`/${artist.slug}/request`} className="btn bg-ink text-bone hover:bg-ink/85">
                {a.cta}
              </a>
            )}
          </div>
        </div>
      </Ch>
    ),
  });

  return <Mag chapters={chapters} labels={{ page: m.page, next: a.panel.next, prev: a.panel.prev }} />;
}

/** Where each of five tiles sits: phone 3×4, wide 4×3. */
const MOSAIC = [
  "[grid-area:1/1/3/3] @3xl:[grid-area:1/1/4/3]",
  "[grid-area:1/3/3/4] @3xl:[grid-area:1/3/2/5]",
  "[grid-area:3/1/5/2] @3xl:[grid-area:2/3/4/4]",
  "[grid-area:3/2/4/4] @3xl:[grid-area:2/4/3/5]",
  "[grid-area:4/2/5/4] @3xl:[grid-area:3/4/4/5]",
];

/* ------------------------------------------------------------------ the magazine */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Mag({ chapters, labels }: { chapters: { key: string; label: string; node: React.ReactNode }[]; labels: { page: string; next: string; prev: string } }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const n = chapters.length;
  const lock = useRef(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const go = useCallback(
    (k: number) => {
      const el = scroller.current;
      if (!el) return;
      const to = Math.max(0, Math.min(n - 1, k));
      el.scrollTo({ left: to * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
    },
    [n],
  );

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
    <div className="mag-root flex h-[calc(100dvh-4.2rem)] min-h-[520px] flex-col">
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
          <div key={c.key} className="h-full w-full flex-none snap-start">
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

/* ------------------------------------------------------------------ pieces of a chapter */

function Ch({ tone, children }: { tone: "ink" | "bone" | "accent"; children: React.ReactNode }) {
  const look = tone === "ink" ? "bg-ink text-bone" : tone === "bone" ? "bg-bone text-ink" : "bg-accent text-ink";
  return (
    <section className={`mag-ch relative h-full w-full overflow-hidden [container-type:size] ${look}`}>
      {tone === "ink" && <div className="p-halftone" aria-hidden />}
      {children}
    </section>
  );
}

/** A photograph, or the striped plate with its title until there is one. */
function Fig({ src, grey, duo, title, caption, sub, delay, className = "" }: { src?: string | null; grey?: boolean; duo?: boolean; title: string; caption?: string; sub?: string; delay?: string; className?: string }) {
  // Callers that place the figure themselves pass `absolute`; everyone else gets a positioned box for the caption.
  const pos = /\babsolute\b/.test(className) ? "" : "relative";
  return (
    <figure data-img style={{ "--d": delay ?? "0ms" } as React.CSSProperties} className={`${pos} overflow-hidden bg-[#161412] [container-type:inline-size] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} loading="lazy" className={`block h-full w-full object-cover ${grey ? "grayscale contrast-[1.08]" : ""}`} />
      ) : (
        <div className="grid h-full w-full place-items-center p-[6cqw]">
          <span aria-hidden className="mag-stripes absolute inset-0 opacity-25" />
          <span className="p-script relative text-center text-[clamp(1rem,9cqw,1.8rem)] leading-tight text-bone/70">{title}</span>
        </div>
      )}
      {duo && src && <div aria-hidden className="absolute inset-0 bg-accent opacity-85 mix-blend-multiply" />}
      {caption && (
        <figcaption className="absolute right-0 bottom-0 left-0 flex items-baseline justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-[4cqw] pt-[8cqw] pb-[3cqw] text-bone">
          <span className="p-stamp truncate">{caption}</span>
          {sub && <span className="p-stamp shrink-0 text-bone/60">{sub}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="opacity-60">{label}</dt>
      <dd className="text-current opacity-100">{children}</dd>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <li>
      <span className="p-display block text-[clamp(1.8rem,7cqw,4rem)] leading-none text-ink">{n}</span>
      <span className="p-stamp mt-1 block text-ink/60">{label}</span>
    </li>
  );
}

function Stop({ year, label, first = false }: { year: string; label: string; first?: boolean }) {
  return (
    <li className="relative shrink-0 border-t-2 border-ink pt-2 pr-[3cqw]">
      <span aria-hidden className={`absolute -top-[5px] left-0 h-2 w-2 rounded-full ${first ? "bg-accent" : "bg-ink"}`} />
      <span className="p-stamp block text-ink/60">{year}</span>
      <span className="p-display block text-[clamp(1rem,3cqw,1.6rem)] text-ink">{label}</span>
    </li>
  );
}
