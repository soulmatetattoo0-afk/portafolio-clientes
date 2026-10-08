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
 * sideways, each one a spread of type and photographs. The cover, the artist
 * and the career, then one spread per piece in rotating templates (split,
 * full bleed, pull quote, contact sheet) so no two pages in a row look alike,
 * and the sign-off.
 */
export function Bio({ data }: { data: ExperienceData }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const p = a.panel.bio;
  const m = p.mag;
  const styles = artist.styles.map((s) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s);
  const paragraphs = (artist.bio ?? "").split(/\n{2,}/).filter(Boolean);
  const featured = data.portfolio.filter((i) => i.featured);
  const extras = data.portfolio.filter((i) => !i.featured);
  const year = new Date().getFullYear();
  const years = artist.since_year ? Math.max(1, year - artist.since_year) : null;
  const cities = Array.from(new Set(data.stops.map((s) => s.city)));
  const away = data.stops.filter((s) => !s.is_home);
  const home = data.stops.find((s) => s.is_home);
  const place = (slug: string) => (PLACEMENT_BY_SLUG.get(slug) ?? ZONE_BY_SLUG.get(slug))?.label[locale] ?? slug;
  const styleOf = (piece: PortfolioItem) => (piece.style ? (STYLE_BY_SLUG.get(piece.style)?.label[locale] ?? piece.style) : null);
  const portrait = artist.portrait_url ? { src: artist.portrait_url, grey: !artist.cover_poster } : null;
  const folio = `${BRAND.name} · ${m.vol} 01`;
  const num = (k: number) => String(k + 1).padStart(2, "0");
  /** The one line under a title: style and placement. */
  const line = (piece: PortfolioItem) => [styleOf(piece), piece.placement ? place(piece.placement) : null].filter(Boolean).join(" · ");
  const specs = (piece: PortfolioItem) => (
    <>
      {styleOf(piece) && <Fact label={m.style}>{styleOf(piece)}</Fact>}
      {piece.placement && <Fact label={m.placement}>{place(piece.placement)}</Fact>}
      {piece.color_mode && <Fact label={m.colour}>{piece.color_mode === "color" ? m.color : m.blackGrey}</Fact>}
      <Fact label={m.status}>{piece.is_healed ? m.healed : m.fresh}</Fact>
    </>
  );

  const chapters: { key: string; label: string; node: React.ReactNode }[] = [];

  // The cover: the artist's own poster, untouched, with only the volume line at the foot.
  chapters.push({
    key: "cover",
    label: m.issue,
    node: (
      <Ch tone="ink">
        <div className="absolute inset-0 [container-type:size] @3xl:left-1/2 @3xl:w-[62cqh] @3xl:-translate-x-1/2">
          <div className="absolute inset-0 overflow-hidden" data-img>
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait.src} alt={artist.display_name} draggable={false} className={`block h-full w-full object-cover object-top ${portrait.grey ? "grayscale contrast-[1.08]" : ""}`} />
            ) : (
              <div className="mag-stripes absolute inset-0 opacity-30" />
            )}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-black/80 to-transparent" />
          </div>
          <div className="absolute right-[4cqw] bottom-[3cqw] left-[4cqw] flex items-end justify-between gap-[3cqw]">
            <p data-r className="p-stamp text-[clamp(0.55rem,2.2cqw,0.8rem)] leading-[1.6] text-bone/80">
              {m.issue}
              <br />
              {BRAND.name} · {m.vol} 01 · {year}
            </p>
            {artist.accepting && (
              <a href={`/${artist.slug}/request`} data-r style={{ "--d": "200ms" } as React.CSSProperties} className="p-display -rotate-[6deg] border-2 border-accent px-[2cqw] py-[0.7cqw] text-[clamp(0.85rem,3.6cqw,1.6rem)] leading-none text-accent">
                {a.deck.sign.toUpperCase()}
              </a>
            )}
          </div>
        </div>
      </Ch>
    ),
  });

  // The artist and the career: the portrait holds the right half, the facts stack on the left, the styles run along the foot.
  const stops = [
    ...(artist.since_year ? [{ id: "since", year: String(artist.since_year), label: m.started, first: true }] : []),
    ...(home ? [{ id: home.id, year: m.home, label: home.city, first: false }] : []),
    ...away.slice(0, 3).map((s) => ({ id: s.id, year: s.starts_on ? String(new Date(s.starts_on).getFullYear()) : String(year), label: s.city, first: false })),
  ].slice(0, 4);
  chapters.push({
    key: "artist",
    label: m.artist,
    node: (
      <Ch tone="bone">
        <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_46cqw] grid-rows-[1fr_auto] gap-x-[4cqw] gap-y-[2cqh] p-[4cqw] pb-[3cqw] @3xl:grid-cols-[minmax(0,1fr)_38cqw] @3xl:gap-x-[5cqw] @3xl:p-[4cqw]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <Head kicker={`01 · ${m.artist}`} folio={folio} compact />
            <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display mt-[1cqh] text-[clamp(2rem,11cqw,6.5rem)] text-ink @3xl:text-[7cqw]">
              {m.career}
            </h3>
            <p data-r style={{ "--d": "160ms" } as React.CSSProperties} className="p-col mt-[1.6cqh] line-clamp-6 max-w-[42ch] text-[clamp(0.9rem,3.6cqw,1.3rem)] leading-[1.35] text-ink/85 @3xl:line-clamp-6 @3xl:text-[clamp(1rem,1.5cqw,1.4rem)]">
              {paragraphs.length ? paragraphs.join(" ") : p.noBio}
            </p>
            <ul data-r style={{ "--d": "240ms" } as React.CSSProperties} className="mt-[2cqh] flex flex-1 flex-col justify-evenly border-t-2 border-ink @3xl:flex-none">
              {years !== null && <Stat n={years} label={m.years} />}
              <Stat n={data.portfolio.length} label={m.pieces} />
              <Stat n={cities.length} label={m.cities} />
            </ul>
            {stops.length > 0 && (
              <ol data-r style={{ "--d": "320ms" } as React.CSSProperties} className="flex min-h-0 flex-col justify-end gap-[1.4cqh] pt-[2.4cqh] @3xl:mt-auto @3xl:flex-row @3xl:items-end @3xl:gap-[3cqw]">
                {stops.map((s) => (
                  <Stop key={s.id} year={s.year} label={s.label} first={s.first} />
                ))}
              </ol>
            )}
          </div>
          <Fig src={portrait?.src} grey duo pos="top" title={artist.display_name} className="relative min-h-0" />
          <div className="col-span-2 flex items-end justify-between gap-[3cqw] border-t border-ink/25 pt-[1.6cqh]">
            {styles.length > 0 && (
              <ul data-r style={{ "--d": "380ms" } as React.CSSProperties} className="flex min-w-0 flex-wrap gap-1.5">
                {styles.map((s) => (
                  <li key={s} className="p-stamp bg-ink px-2.5 py-1.5 text-[clamp(0.52rem,2.4cqw,0.68rem)] text-bone">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {artist.min_price_cents ? (
              <p data-r style={{ "--d": "440ms" } as React.CSSProperties} className="shrink-0 text-right">
                <span className="p-stamp block text-[clamp(0.52rem,2.4cqw,0.68rem)] text-ink/60">{p.starting}</span>
                <span className="p-display block text-[clamp(1.4rem,7cqw,2.6rem)] text-accent">{money(artist.min_price_cents, artist.currency, locale)}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Ch>
    ),
  });

  /* The spreads. Every piece gets a page or a place on one, in templates that never repeat back to back.
     Pages alternate paper: ink, bone, ink. A full-bleed photograph counts as ink. */
  let prev: Template | null = null;
  let tone: "ink" | "bone" = "bone";

  // The pieces people ask for most: one spread each.
  const FEATURED: Template[] = ["split", "bleed", "quote", "split-r", "bleed", "quote"];
  for (const [i, piece] of featured.entries()) {
    const kind = FEATURED[i % FEATURED.length];
    const n = num(i);
    const kicker = `02 · ${m.popular}`;
    tone = after(tone, kind);
    prev = kind;
    chapters.push({
      key: `pop-${piece.id}`,
      label: `${m.popular} ${n}`,
      node:
        kind === "bleed" ? (
          <Bleed piece={piece} n={n} kicker={kicker} line={line(piece)} title={piece.title ?? m.work} corner={i % 4 === 1 ? "bl" : "tr"} />
        ) : kind === "quote" ? (
          <Quote tone={tone} piece={piece} n={n} kicker={kicker} folio={folio} title={piece.title ?? m.work} story={piece.story ?? m.noStory} specs={specs(piece)} />
        ) : (
          <Split tone={tone} piece={piece} n={n} kicker={kicker} title={piece.title ?? m.work} story={piece.story ?? m.noStory} specs={specs(piece)} mirror={kind === "split-r"} />
        ),
    });
  }
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

  // The archive: the rest of the work as contact sheets, a full page between every two sheets.
  const rest = [...extras];
  let k = featured.length;
  let sheet = 0;
  while (rest.length) {
    const kicker = `03 · ${m.archive}`;
    const bleedNow = rest.length === 1 ? prev !== "bleed" : sheet % 2 === 1 && rest.length > 2;
    if (bleedNow) {
      const piece = rest.shift()!;
      tone = after(tone, "bleed");
      prev = "bleed";
      chapters.push({
        key: `arc-${piece.id}`,
        label: `${m.index} ${num(k)}`,
        node: <Bleed piece={piece} n={num(k)} kicker={kicker} line={line(piece)} title={piece.title ?? m.work} corner={k % 2 === 0 ? "bl" : "tr"} />,
      });
      k += 1;
      sheet = 0;
      continue;
    }
    const take = rest.length === 4 ? 2 : Math.min(3, rest.length);
    const slice = rest.splice(0, take);
    const first = k;
    tone = after(tone, "contact");
    prev = "contact";
    chapters.push({
      key: `arc-${slice[0].id}`,
      label: `${m.index} ${num(first)}`,
      node: (
        <Ch tone={tone}>
          <div className="absolute inset-0 flex flex-col p-[4cqw] @3xl:p-[4cqw]">
            <Head kicker={kicker} folio={fill(a.panel.work.count, { n: data.portfolio.length })} />
            <ol className={`mt-[2cqh] grid min-h-0 flex-1 gap-[2cqh] @3xl:mt-[3cqh] @3xl:gap-[3cqw] ${slice.length === 1 ? "grid-rows-1 @3xl:grid-cols-1" : slice.length === 2 ? "grid-rows-2 @3xl:grid-cols-2 @3xl:grid-rows-1" : "grid-rows-3 @3xl:grid-cols-3 @3xl:grid-rows-1"}`}>
              {slice.map((piece, j) => (
                <li key={piece.id} className={`grid min-h-0 grid-cols-[42cqw_minmax(0,1fr)] gap-[3cqw] border-t border-current/25 pt-[1.4cqh] @3xl:grid-cols-1 @3xl:grid-rows-[1fr_auto] @3xl:gap-[1.5cqh] ${j % 2 === 1 ? "@max-3xl:[&>figure]:order-2" : ""}`}>
                  <Fig src={piece.url} pos={posOf(piece)} title={piece.title ?? m.work} delay={`${j * 120}ms`} className="relative min-h-0 h-full" />
                  <div className={`flex min-w-0 flex-col ${j % 2 === 1 ? "@max-3xl:items-end @max-3xl:text-right" : ""}`}>
                    <span aria-hidden data-r style={{ "--d": `${j * 120}ms` } as React.CSSProperties} className="p-display text-[clamp(1.8rem,9cqw,4rem)] leading-none text-accent @3xl:text-[4cqw]">
                      {num(first + j)}
                    </span>
                    <h3 data-r style={{ "--d": `${j * 120 + 60}ms` } as React.CSSProperties} className="p-display mt-[0.6cqh] text-[clamp(1.1rem,5.6cqw,2.4rem)] @3xl:text-[2.4cqw]">
                      {piece.title ?? m.work}
                    </h3>
                    <dl data-r style={{ "--d": `${j * 120 + 120}ms` } as React.CSSProperties} className="p-stamp mt-auto grid gap-[0.5cqh] pt-[1cqh] text-[clamp(0.5rem,2.4cqw,0.68rem)] tracking-[0.16em] opacity-80 @3xl:text-[0.68rem] @3xl:tracking-[0.26em]">
                      {specs(piece)}
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Ch>
      ),
    });
    k += take;
    sheet += 1;
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

type Template = "split" | "split-r" | "bleed" | "quote" | "contact";

/** The paper of the next page: ink after bone, bone after ink; a full-bleed photograph is ink. */
const after = (tone: "ink" | "bone", kind: Template): "ink" | "bone" => (kind === "bleed" ? "ink" : tone === "ink" ? "bone" : "ink");

/** Where to crop a photograph when it has to lose something: faces and backs keep the top. */
function posOf(piece: PortfolioItem): "top" | "center" {
  return /back|chest|neck|head|face|sleeve|arm|forearm|shoulder/.test(piece.placement ?? "") ? "top" : "center";
}

/* ------------------------------------------------------------------ the spreads */

/** A running head: the chapter kicker on the left, the folio on the right. */
function Head({ kicker, folio, compact = false }: { kicker: string; folio: string; compact?: boolean }) {
  return (
    <p data-r className="flex items-baseline justify-between gap-3">
      <span className="p-gothic whitespace-nowrap text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">{kicker}</span>
      <span className={`p-stamp shrink-0 text-[clamp(0.5rem,2.4cqw,0.68rem)] opacity-50 ${compact ? "hidden @3xl:inline" : ""}`}>{folio}</span>
    </p>
  );
}

/** Split: the photograph takes the tall left (or right) column, the words stack beside it. */
function Split({ tone, piece, n, kicker, title, story, specs, mirror }: { tone: "ink" | "bone"; piece: PortfolioItem; n: string; kicker: string; title: string; story: string; specs: React.ReactNode; mirror: boolean }) {
  return (
    <Ch tone={tone}>
      <div className={`absolute inset-0 grid grid-cols-[58%_minmax(0,1fr)] ${mirror ? "[direction:rtl]" : ""}`}>
        <Fig src={piece.url} pos={posOf(piece)} title={title} className="relative h-full w-full [direction:ltr]" />
        <div className="relative flex min-h-0 min-w-0 flex-col px-[3cqw] py-[3cqh] [direction:ltr] @3xl:px-[4cqw]">
          <span aria-hidden data-r className="p-display text-[clamp(3rem,16cqw,9rem)] leading-[0.85] text-accent">
            {n}
          </span>
          <p data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-gothic mt-[1cqh] text-[clamp(0.9rem,4.2cqw,1.5rem)] text-accent">
            {kicker}
          </p>
          <h3 data-r style={{ "--d": "140ms" } as React.CSSProperties} className="p-display mt-[1cqh] break-words text-[clamp(1.3rem,6cqw,4.5rem)] hyphens-auto @3xl:text-[5cqw]">
            {title}
          </h3>
          <p data-r style={{ "--d": "220ms" } as React.CSSProperties} className="p-quote mt-[1.6cqh] line-clamp-[9] min-h-0 text-[clamp(0.9rem,4.1cqw,1.6rem)] leading-[1.28] opacity-85 @3xl:line-clamp-[7] @3xl:max-w-[34ch] @3xl:text-[clamp(1.2rem,1.9cqw,1.8rem)]">
            {story}
          </p>
          <dl data-r style={{ "--d": "300ms" } as React.CSSProperties} className="p-stamp mt-auto grid gap-[0.7cqh] border-t border-current/25 pt-[1.6cqh] text-[clamp(0.5rem,2.5cqw,0.68rem)] tracking-[0.16em] opacity-80 @3xl:grid-cols-2 @3xl:gap-x-6 @3xl:text-[0.68rem] @3xl:tracking-[0.26em]">
            {specs}
          </dl>
        </div>
      </div>
    </Ch>
  );
}

/** Full bleed: the photograph is the page; a numeral, a title and one line sit in a corner, over a gradient. */
function Bleed({ piece, n, kicker, title, line, corner }: { piece: PortfolioItem; n: string; kicker: string; title: string; line: string; corner: "bl" | "tr" }) {
  const top = corner === "tr";
  return (
    <Ch tone="ink">
      <Fig src={piece.url} pos={posOf(piece)} title={title} className="absolute inset-0" />
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 h-[46%] ${top ? "top-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent" : "bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent"}`} />
      <div className={`absolute inset-x-[4cqw] flex flex-col ${top ? "top-[3cqh] items-end text-right" : "bottom-[3cqh]"}`}>
        <span aria-hidden data-r className="p-display text-[clamp(4rem,24cqw,14rem)] leading-[0.85] text-accent">
          {n}
        </span>
        <p data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-gothic mt-[0.6cqh] text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">
          {kicker}
        </p>
        <h3 data-r style={{ "--d": "140ms" } as React.CSSProperties} className="p-display mt-[0.6cqh] max-w-[12ch] text-[clamp(1.9rem,9.5cqw,6rem)] text-bone @3xl:text-[6cqw]">
          {title}
        </h3>
        {line && (
          <p data-r style={{ "--d": "220ms" } as React.CSSProperties} className="p-stamp mt-[1.2cqh] text-[clamp(0.55rem,2.6cqw,0.72rem)] text-bone/75">
            {line}
          </p>
        )}
      </div>
    </Ch>
  );
}

/** Pull quote: a photograph across the top, then the story set large in italics beside the numeral. */
function Quote({ tone, piece, n, kicker, folio, title, story, specs }: { tone: "ink" | "bone"; piece: PortfolioItem; n: string; kicker: string; folio: string; title: string; story: string; specs: React.ReactNode }) {
  return (
    <Ch tone={tone}>
      <div className="absolute inset-0 grid grid-rows-[49%_1fr] @3xl:grid-cols-[46%_minmax(0,1fr)] @3xl:grid-rows-1">
        <div className="relative min-h-0">
          <Fig src={piece.url} pos={posOf(piece)} title={title} className="absolute inset-0" />
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t ${tone === "ink" ? "from-ink" : "from-bone"} to-transparent @3xl:hidden`} />
        </div>
        <div className="relative flex min-h-0 flex-col px-[4cqw] pt-0 pb-[2.4cqh] @3xl:justify-center @3xl:px-[5cqw] @3xl:py-[4cqh]">
          <div className="flex items-end gap-[3cqw]">
            <span aria-hidden data-r className="p-display -mt-[8cqh] text-[clamp(4.5rem,24cqw,14rem)] leading-[0.8] text-accent @3xl:mt-0 @3xl:text-[12cqw]">
              {n}
            </span>
            <div className="min-w-0 pb-[0.5cqh]">
              <Head kicker={kicker} folio={folio} />
              <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display mt-[0.4cqh] text-[clamp(1.1rem,5.4cqw,3rem)] @3xl:text-[2.8cqw]">
                {title}
              </h3>
            </div>
          </div>
          <p data-r style={{ "--d": "160ms" } as React.CSSProperties} className="p-quote mt-[2cqh] line-clamp-[7] min-h-0 text-[clamp(1.4rem,7cqw,3.2rem)] opacity-90 @3xl:mt-[3cqh] @3xl:line-clamp-[6] @3xl:max-w-[22ch] @3xl:text-[clamp(1.7rem,3.4cqw,3rem)]">
            “{story}”
          </p>
          <dl data-r style={{ "--d": "260ms" } as React.CSSProperties} className="p-stamp mt-auto flex flex-wrap gap-x-[4cqw] gap-y-[0.6cqh] border-t border-current/25 pt-[1.4cqh] text-[clamp(0.5rem,2.5cqw,0.68rem)] tracking-[0.16em] opacity-80 @3xl:text-[0.68rem] @3xl:tracking-[0.26em]">
            {specs}
          </dl>
        </div>
      </div>
    </Ch>
  );
}

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
function Fig({ src, grey, duo, pos = "center", title, caption, sub, delay, className = "" }: { src?: string | null; grey?: boolean; duo?: boolean; pos?: "top" | "center"; title: string; caption?: string; sub?: string; delay?: string; className?: string }) {
  // Callers that place the figure themselves pass `absolute`; everyone else gets a positioned box for the caption.
  const box = /\babsolute\b/.test(className) ? "" : "relative";
  return (
    <figure data-img style={{ "--d": delay ?? "0ms" } as React.CSSProperties} className={`${box} overflow-hidden bg-[#161412] [container-type:inline-size] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} loading="lazy" className={`block h-full w-full object-cover ${pos === "top" ? "object-top" : "object-center"} ${grey ? "grayscale contrast-[1.08]" : ""}`} />
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
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
      <dt className="opacity-55">{label}</dt>
      <dd className="text-current">{children}</dd>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-baseline gap-[2.5cqw] border-b border-ink/20 py-[1.1cqh]">
      <span className="p-display text-[clamp(1.8rem,9.5cqw,3.4rem)] leading-none text-ink @3xl:text-[3.2cqw]">{n}</span>
      <span className="p-stamp text-[clamp(0.5rem,2.4cqw,0.68rem)] text-ink/60">{label}</span>
    </li>
  );
}

function Stop({ year, label, first = false }: { year: string; label: string; first?: boolean }) {
  return (
    <li className="relative flex items-baseline gap-[2.5cqw] pl-[3.5cqw] @3xl:block @3xl:shrink-0 @3xl:border-t-2 @3xl:border-ink @3xl:pt-2 @3xl:pr-[3cqw] @3xl:pl-0">
      <span aria-hidden className={`absolute top-[0.35em] left-0 h-2 w-2 rounded-full @3xl:-top-[5px] ${first ? "bg-accent" : "bg-ink"}`} />
      <span className="p-stamp min-w-[6ch] shrink-0 text-[clamp(0.5rem,2.4cqw,0.68rem)] text-ink/60 @3xl:block @3xl:min-w-0">{year}</span>
      <span className="p-display truncate text-[clamp(1rem,5.2cqw,1.6rem)] text-ink @3xl:block @3xl:text-[1.6cqw]">{label}</span>
    </li>
  );
}
