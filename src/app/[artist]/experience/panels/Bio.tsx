"use client";

import { fill } from "@/i18n";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { PLACEMENT_BY_SLUG, ZONE_BY_SLUG } from "@/mannequin/catalog";
import { money } from "@/lib/format";
import type { PortfolioItem } from "@/lib/queries";

import { coverWordOf, type ExperienceData } from "../types";

/**
 * The artist's own magazine, the one that lies on the studio table: a cover,
 * a welcome with the contents, the artist, then a page per piece they chose
 * with their words beside it, collage pages of work in between, and thanks.
 * Paper is white, type is black, the one colour is the artist's accent.
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

  // Pages: welcome, artist, then features with a collage after every second one, then thanks.
  const pages: React.ReactNode[] = [];
  let n = 1;
  const folio = () => String(n++).padStart(2, "0");

  pages.push(
    <Page key="welcome" head={head} folio={folio()}>
      <div className="grid gap-10 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <Numeral n="01" />
          <h3 className="mag-h mt-6">{m.welcome}</h3>
          <p className="mag-kicker mt-3">{m.welcomeLead}</p>
          <p className="mag-body mt-4 max-w-[42ch]">{artist.headline ?? paragraphs[0] ?? ""}</p>
        </div>
        <div className="relative border-l border-ink/15 pl-6">
          <span className="mag-side">{m.contents}</span>
          <ol className="grid gap-2.5">
            <Toc n="01">{m.welcome}</Toc>
            <Toc n="02">{m.artist}</Toc>
            {featured.map((f, i) => (
              <Toc key={f.id} n={String(i + 3).padStart(2, "0")}>
                {f.title ?? m.work}
              </Toc>
            ))}
            <Toc n={String(featured.length + 3).padStart(2, "0")}>{m.thanks}</Toc>
          </ol>
        </div>
      </div>
    </Page>,
  );

  pages.push(
    <Page key="artist" head={head} folio={folio()}>
      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div>
          <h3 className="mag-h">{artist.display_name}</h3>
          {artist.headline && <p className="mag-kicker mt-2">{artist.headline}</p>}
          <div className="mag-body mt-5 max-w-[44ch]">
            {paragraphs.length ? paragraphs.map((para, i) => <p key={i} className={i ? "mt-3" : ""}>{para}</p>) : <p className="text-ink/60">{p.noBio}</p>}
          </div>
        </div>
        <div className="relative">
          <Numeral n="02" className="absolute -top-2 right-0" />
          {artist.portrait_url && (
            <div className="relative mt-16 aspect-[3/4] overflow-hidden border-[3px] border-accent">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artist.portrait_url} alt={artist.display_name} className={`h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
            </div>
          )}
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t-2 border-ink pt-4 sm:grid-cols-4">
        {artist.home_city && <Spec label={p.based}>{artist.home_city}</Spec>}
        {artist.since_year && <Spec label={p.since}>{artist.since_year}</Spec>}
        {styles.length > 0 && <Spec label={p.styles}>{styles.join(" · ")}</Spec>}
        {artist.min_price_cents ? <Spec label={p.starting}>{money(artist.min_price_cents, artist.currency, locale)}</Spec> : null}
      </dl>
    </Page>,
  );

  featured.forEach((piece, i) => {
    const num = String(i + 3).padStart(2, "0");
    const specs = (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.82rem]">
        {piece.style && <Row label={m.style}>{STYLE_BY_SLUG.get(piece.style)?.label[locale] ?? piece.style}</Row>}
        {piece.placement && <Row label={m.placement}>{(PLACEMENT_BY_SLUG.get(piece.placement) ?? ZONE_BY_SLUG.get(piece.placement))?.label[locale] ?? piece.placement}</Row>}
        {piece.color_mode && <Row label={m.colour}>{piece.color_mode === "color" ? m.color : m.blackGrey}</Row>}
        <Row label={m.status}>{piece.is_healed ? m.healed : m.fresh}</Row>
      </dl>
    );
    if (i % 2 === 0) {
      // Layout A: the numeral and words on the left, the piece on the right with a striped corner.
      pages.push(
        <Page key={piece.id} head={head} folio={folio()}>
          <div className="grid gap-8 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col">
              <Numeral n={num} />
              <h3 className="mag-h mt-5">{piece.title ?? m.work}</h3>
              <p className="mag-label mt-6">{m.description}</p>
              <p className="mag-body mt-2 max-w-[38ch]">{piece.story ?? m.noStory}</p>
              <div className="mt-auto pt-8">{specs}</div>
            </div>
            <div className="relative pt-6 pr-6">
              <span aria-hidden className="mag-stripes absolute top-0 right-0 h-28 w-16" />
              <Art piece={piece} className="relative aspect-[4/5]" />
            </div>
          </div>
        </Page>,
      );
    } else {
      // Layout B: the piece bleeds left, the words sit on a block of the artist's colour.
      pages.push(
        <Page key={piece.id} head={head} folio={folio()} bleed>
          <div className="grid min-h-full sm:grid-cols-2">
            <Art piece={piece} className="aspect-[4/5] sm:aspect-auto" />
            <div className="relative flex flex-col bg-accent p-7 text-ink">
              <span aria-hidden className="mag-stripes-ink absolute top-7 right-7 h-10 w-14" />
              <Numeral n={num} className="text-ink/80" />
              <h3 className="mag-h mt-5 text-ink">{piece.title ?? m.work}</h3>
              <p className="mag-label mt-6 text-ink/70">{m.description}</p>
              <p className="mag-body mt-2 max-w-[38ch]">{piece.story ?? m.noStory}</p>
              <div className="mt-auto pt-8">{specs}</div>
            </div>
          </div>
        </Page>,
      );
    }
    // A collage of work after every second feature: images only.
    if (i % 2 === 1 || i === featured.length - 1) {
      const slice = rest.slice(((i / 2) | 0) * 4, ((i / 2) | 0) * 4 + 4);
      if (slice.length)
        pages.push(
          <Page key={`collage-${i}`} head={head} folio={folio()} bleed>
            <div className="grid h-full grid-cols-2 gap-[6px] p-[6px]">
              {slice.map((piece, k) => (
                <Art key={piece.id} piece={piece} className={k === 0 && slice.length > 2 ? "row-span-2 aspect-auto" : "aspect-[4/5]"} />
              ))}
            </div>
          </Page>,
        );
    }
  });

  if (!featured.length) {
    pages.push(
      <Page key="empty" head={head} folio={folio()}>
        <Numeral n="03" />
        <p className="mag-body mt-6 max-w-[40ch] text-ink/70">{m.empty}</p>
      </Page>,
    );
  }

  return (
    <article className="pb-16">
      {/* The cover: a poster artist's photo is the cover; anyone else gets the masthead over their portrait. */}
      <section className="relative mx-3 mt-3 overflow-hidden bg-[#0a0a0a] text-bone" style={{ minHeight: "min(132vw, 780px)" }} aria-label={`${word} ${m.vol} 01`}>
        {artist.cover_poster && artist.portrait_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artist.portrait_url} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 p-6">
              <p className="p-display mt-8 text-[clamp(3.2rem,19vw,7rem)] leading-[0.85] text-accent">{word}</p>
            </div>
            <div className="absolute top-[34%] right-6 bottom-20 left-6 border-[3px] border-accent">
              {artist.portrait_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.portrait_url} alt="" className="h-full w-full object-cover object-top grayscale" />
              ) : (
                <div className="mag-stripes h-full w-full opacity-60" />
              )}
            </div>
          </>
        )}
        <div className="absolute inset-x-6 top-5 flex items-start justify-between">
          <span className="p-stamp text-bone/85">{m.issue}</span>
          <span className="p-stamp text-bone/85">{year}</span>
        </div>
        <span aria-hidden className="p-stamp absolute top-[36%] -right-2 origin-right rotate-90 text-bone/80">
          {m.vol} 01
        </span>
        <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between gap-4">
          <div>
            <p className="p-display text-[1.6rem] leading-none">{artist.display_name}</p>
            {artist.home_city && <p className="p-stamp mt-1 text-bone/75">{fill(a.basedIn, { city: artist.home_city })}</p>}
          </div>
          <span aria-hidden className="mag-stripes-bone h-8 w-12" />
        </div>
      </section>

      {pages}

      {/* Thanks. */}
      <section className="relative mx-3 mt-3 overflow-hidden bg-[#0a0a0a] p-6 text-bone" style={{ minHeight: "min(100vw, 600px)" }}>
        <span aria-hidden className="absolute top-6 left-6 h-16 w-px bg-bone/40" />
        <p className="p-display mt-10 text-[clamp(3rem,16vw,6rem)] leading-[0.85]">{m.thanks.toUpperCase()}</p>
        {artist.cover_quote && <p className="p-quote mt-6 max-w-[26ch] text-[1.5rem] text-bone/90">“{artist.cover_quote}”</p>}
        <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between gap-4 border-t border-bone/30 pt-4">
          {artist.instagram ? (
            <a className="p-stamp underline decoration-accent underline-offset-4" href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer">
              {m.scan} · @{artist.instagram}
            </a>
          ) : (
            <span className="p-stamp">{artist.display_name}</span>
          )}
          <span className="p-stamp text-bone/60">
            {word} · {m.vol} 01
          </span>
        </div>
      </section>
    </article>
  );
}

/** One white page: running head, the content, the folio. */
function Page({ head, folio, bleed = false, children }: { head: string; folio: string; bleed?: boolean; children: React.ReactNode }) {
  return (
    <section className="mag-page relative mx-3 mt-3 flex flex-col bg-[#f7f5f0] text-ink" style={{ minHeight: "min(132vw, 780px)" }}>
      <div className="flex items-center justify-between px-6 pt-5">
        <span className="mag-label">{head}</span>
        <span className="mag-label tabular-nums">{folio}</span>
      </div>
      <div className={`min-h-0 flex-1 ${bleed ? "mt-4" : "px-6 pt-7 pb-6"}`}>{children}</div>
    </section>
  );
}

/** The piece as printed: the photo, or a striped plate with its title until there is one. */
function Art({ piece, className = "" }: { piece: PortfolioItem; className?: string }) {
  return (
    <figure className={`relative min-h-0 overflow-hidden bg-[#e9e5dc] ${className}`}>
      {piece.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={piece.url} alt={piece.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="relative grid h-full w-full place-items-center p-6">
          <span aria-hidden className="mag-stripes absolute inset-0 opacity-30" />
          <span className="p-quote relative max-w-[16ch] text-center text-[1.3rem] text-ink/80">{piece.title}</span>
        </div>
      )}
    </figure>
  );
}

function Numeral({ n, className = "" }: { n: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden>
      <span className="mag-stripes absolute -top-3 -right-5 h-14 w-14" />
      <span className="p-display relative text-[clamp(3.6rem,18vw,6.5rem)] leading-[0.8]">{n}</span>
    </span>
  );
}

function Toc({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3 text-[0.9rem]">
      <span className="tabular-nums text-ink/50">{n}.</span>
      <span className="truncate">{children}</span>
    </li>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mag-label">{label}</dt>
      <dd className="mt-1 text-[0.95rem]">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mag-label">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </>
  );
}
