"use client";

import Link from "next/link";

import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

import { CityRequest } from "../../CityRequest";
import { Waitlist } from "../../Waitlist";
import { PanelHead } from "../Panel";
import { pinsOf } from "../pins";
import type { ExperienceData } from "../types";
import { WorldMap } from "../WorldMap";

/**
 * Tour poster: the world lit up where the artist works and where people
 * ask for them, then the itinerary as a route, home first, then the
 * invitation to name your city with the cities already asking.
 */
export function Spots({ data }: { data: ExperienceData }) {
  const { artist, t, locale, stops } = data;
  const a = t.artist;
  const p = a.panel.spots;
  const next = stops.find((s) => !s.is_home && s.status !== "done");
  const max = Math.max(1, ...data.demand.map((d) => d.n));

  return (
    <div className="pb-16">
      <PanelHead id="spots" kicker={a.deck.cards.spots.kicker} title={a.deck.cards.spots.title} lead={p.lead} />

      {/* The world: gold continents, the home, the stops, the asking cities. */}
      <figure className="relative mx-5 overflow-hidden rounded-[22px] border border-line bg-[radial-gradient(ellipse_at_50%_40%,#17130f,#0a0a0a_70%)] px-3 pt-6 pb-4">
        <div className="p-halftone" aria-hidden />
        <WorldMap pins={pinsOf(data)} className="relative w-full" />
        <figcaption className="relative mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
          <span className="flex items-center gap-2 text-[0.8rem] text-bone/80">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            {stops.length} {a.deck.cards.spots.title.toLowerCase()}
          </span>
          {data.demand.length > 0 && (
            <span className="flex items-center gap-2 text-[0.8rem] text-bone/80">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[#fff3cf] shadow-[0_0_8px_#ffd98a]" />
              {p.demandTitle}
            </span>
          )}
          {next && (
            <span className="p-gothic text-[1.05rem] text-accent">
              {next.city} · {dateRange(next.starts_on, next.ends_on, locale)}
            </span>
          )}
        </figcaption>
      </figure>

      {/* The route. */}
      {stops.length === 0 ? (
        <p className="mt-8 px-5 text-bone-dim">{p.empty}</p>
      ) : (
        <ol className="relative mt-10 ml-5 border-l-2 border-line pl-6 pr-5">
          {stops.map((s, i) => {
            const tone = s.status === "booking" ? "text-accent" : s.status === "full" ? "text-oxblood" : "text-bone-dim";
            return (
              <li key={s.id} className="relative pb-10 last:pb-0">
                {/* the stop on the line */}
                <span aria-hidden className={`absolute top-[0.85rem] -left-[calc(1.5rem+5px)] h-2.5 w-2.5 rounded-full ${s.is_home ? "bg-bone shadow-[0_0_10px_var(--color-bone)]" : "bg-accent shadow-[0_0_10px_var(--accent)]"}`} />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="p-gothic text-[1.15rem] text-bone-dim">
                      {String(i + 1).padStart(2, "0")} · {s.is_home ? a.home : s.country}
                    </p>
                    <p className="p-display mt-1 text-[clamp(2.8rem,13vw,5rem)] leading-[0.88]">{s.city}</p>
                    <p className="p-quote mt-2 text-[1.25rem] text-bone/85">{s.is_home ? s.studio_name : dateRange(s.starts_on, s.ends_on, locale)}</p>
                    {!s.is_home && s.studio_name && <p className="p-stamp mt-1 text-bone-dim">{s.studio_name}</p>}
                  </div>
                  <span className={`p-stamp mt-2 shrink-0 rounded-full border border-current px-2.5 py-1 text-[0.6rem] ${tone}`}>{a.status[s.status]}</span>
                </div>
                {(s.status === "announced" || s.status === "full") && (
                  <div className="mt-4">
                    <Waitlist
                      artistId={artist.id}
                      stopId={s.id}
                      city={s.city}
                      labels={{ notify: a.notifyMe, title: fill(a.waitlistTitle, { city: s.city }), email: a.waitlistEmail, join: fill(a.waitlistJoin, { city: s.city }) }}
                    />
                  </div>
                )}
                {s.status === "booking" && artist.accepting && (
                  <Link href={`/${artist.slug}/request`} className="btn btn-secondary mt-4 w-fit">
                    {a.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Ask me to come: the public names its city; the artist sees where the demand is. */}
      <section className="relative mx-5 mt-14 overflow-hidden rounded-[22px] border border-line bg-ink-2 p-5" aria-labelledby="your-city">
        <span aria-hidden className="p-gothic pointer-events-none absolute -top-4 -right-2 text-[7rem] leading-none text-bone/[0.06]">✈</span>
        <p className="p-gothic text-[1.2rem] text-accent">{p.demandTitle}</p>
        <h3 id="your-city" className="p-display mt-1 text-[clamp(2.6rem,12vw,4rem)] leading-[0.9]">
          {p.yourCity}
        </h3>
        <p className="mt-3 mb-5 max-w-[44ch] text-[0.95rem] text-bone/80">{p.requestLead}</p>
        <CityRequest artistId={artist.id} labels={{ city: p.requestCity, email: p.requestEmail, send: p.requestSend }} />
        {data.demand.length > 0 && (
          <ol className="mt-6 grid gap-2.5 border-t border-line pt-5">
            {data.demand.map((d, i) => (
              <li key={d.city} className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-3 text-[0.95rem]">
                <span className="p-gothic text-[1.05rem] text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="relative min-w-0">
                  <span aria-hidden className="absolute inset-y-0 left-0 rounded-sm bg-[linear-gradient(90deg,rgb(212_168_75/0.55),rgb(212_168_75/0.08))]" style={{ width: `${Math.max(8, (d.n / max) * 100)}%` }} />
                  <span className="relative block truncate px-2 py-0.5">{d.city}</span>
                </span>
                <span className="t-num shrink-0 text-bone-dim">{fill(d.n === 1 ? p.demandOne : p.demandMany, { n: d.n })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
