"use client";

import { fill } from "@/i18n";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { money } from "@/lib/format";

import { PanelHead } from "../Panel";
import type { ExperienceData } from "../types";

export function Bio({ data }: { data: ExperienceData }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const p = a.panel.bio;
  const styles = artist.styles.map((s) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s);
  const paragraphs = (artist.bio ?? "").split(/\n{2,}/).filter(Boolean);
  return (
    <article className="pb-16">
      <PanelHead id="bio" kicker={a.deck.cards.bio.kicker} title={artist.display_name} />

      {artist.portrait_url && (
        <figure className="relative mx-5 aspect-[4/5] overflow-hidden rounded-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artist.portrait_url} alt={artist.display_name} className={`h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale contrast-[1.08]"}`} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
          {artist.headline && <figcaption className="p-quote absolute right-5 bottom-5 left-5 text-[1.5rem] text-bone">{artist.headline}</figcaption>}
        </figure>
      )}

      {/* Credit block, like the facts strip at the foot of a poster. */}
      <dl className="mx-5 mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y-2 border-bone py-5">
        {artist.home_city && <Fact label={p.based}>{artist.home_city}</Fact>}
        {artist.since_year && <Fact label={p.since}>{artist.since_year}</Fact>}
        {artist.min_price_cents ? <Fact label={p.starting}>{money(artist.min_price_cents, artist.currency, locale)}</Fact> : null}
        {artist.instagram && (
          <Fact label="Instagram">
            <a className="underline decoration-accent underline-offset-4" href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer">
              @{artist.instagram}
            </a>
          </Fact>
        )}
      </dl>

      {styles.length > 0 && (
        <div className="mt-8 overflow-hidden border-y border-line py-3" aria-label={p.styles}>
          <div className="p-marquee flex w-max gap-8 whitespace-nowrap">
            {[...styles, ...styles, ...styles, ...styles].map((s, i) => (
              <span key={i} className="p-display text-[1.8rem] text-bone/70">
                {s} <span className="text-accent">✦</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="p-col mx-5 mt-8 max-w-[58ch] text-bone/90">
        {paragraphs.length ? (
          paragraphs.map((para, i) => (
            <p key={i} className={i === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-[family-name:var(--font-poster)] first-letter:text-[4.2rem] first-letter:leading-[0.8] first-letter:text-accent" : "mt-5"}>
              {para}
            </p>
          ))
        ) : (
          <p className="text-bone-dim">{p.noBio}</p>
        )}
      </div>

      {artist.cover_quote && <p className="p-quote mx-5 mt-10 max-w-[26ch] text-[1.9rem] text-bone">“{artist.cover_quote}”</p>}

      {artist.instagram && (
        <a className="btn btn-secondary mx-5 mt-10" href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer">
          {p.follow} · @{artist.instagram}
        </a>
      )}
      {artist.home_city && <p className="sr-only">{fill(a.basedIn, { city: artist.home_city })}</p>}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="p-stamp text-bone-dim">{label}</dt>
      <dd className="mt-1 text-[1.1rem]">{children}</dd>
    </div>
  );
}
