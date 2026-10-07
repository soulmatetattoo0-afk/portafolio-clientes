"use client";

import Link from "next/link";

import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

import { CityRequest } from "../../CityRequest";
import { Waitlist } from "../../Waitlist";
import { PanelHead } from "../Panel";
import type { ExperienceData } from "../types";

/** Tour poster: every city the artist tattoos in, home first, with dates and a waitlist. */
export function Spots({ data }: { data: ExperienceData }) {
  const { artist, t, locale, stops } = data;
  const a = t.artist;
  const p = a.panel.spots;
  return (
    <div className="pb-16">
      <PanelHead id="spots" kicker={a.deck.cards.spots.kicker} title={a.deck.cards.spots.title} lead={p.lead} />
      {stops.length === 0 ? (
        <p className="px-5 text-bone-dim">{p.empty}</p>
      ) : (
        <ol className="border-t-2 border-bone">
          {stops.map((s, i) => {
            const tone = s.status === "booking" ? "text-accent" : s.status === "full" ? "text-oxblood" : "text-bone-dim";
            return (
              <li key={s.id} className="grid gap-3 border-b border-line px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="p-stamp text-bone-dim">
                      {String(i + 1).padStart(2, "0")} · {s.is_home ? a.home : s.country}
                    </p>
                    <p className="p-display mt-1 text-[clamp(2.6rem,12vw,4.5rem)] leading-[0.9]">{s.city}</p>
                    <p className="mt-2 text-[0.95rem] text-bone/80">{[s.studio_name, s.is_home ? null : dateRange(s.starts_on, s.ends_on, locale)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`p-stamp mt-1 shrink-0 rounded-full border border-current px-2.5 py-1 text-[0.6rem] ${tone}`}>{a.status[s.status]}</span>
                </div>
                {(s.status === "announced" || s.status === "full") && (
                  <Waitlist
                    artistId={artist.id}
                    stopId={s.id}
                    city={s.city}
                    labels={{ notify: a.notifyMe, title: fill(a.waitlistTitle, { city: s.city }), email: a.waitlistEmail, join: fill(a.waitlistJoin, { city: s.city }) }}
                  />
                )}
                {s.status === "booking" && artist.accepting && (
                  <Link href={`/${artist.slug}/request`} className="btn btn-secondary w-fit">
                    {a.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {/* Ask me to come: the public names its city; the artist sees where the demand is. */}
      <section className="mx-5 mt-10 rounded-[18px] border border-dashed border-line-strong p-5" aria-labelledby="your-city">
        <h3 id="your-city" className="p-display text-[2rem]">
          ✈ {p.yourCity}
        </h3>
        <p className="mt-2 mb-4 text-[0.92rem] text-bone/80">{p.requestLead}</p>
        <CityRequest artistId={artist.id} labels={{ city: p.requestCity, email: p.requestEmail, send: p.requestSend }} />
        {data.demand.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="p-gothic text-[1.15rem] text-accent">{p.demandTitle}</p>
            <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {data.demand.map((d) => (
                <li key={d.city} className="flex items-baseline justify-between gap-2 text-[0.95rem]">
                  <span className="truncate">{d.city}</span>
                  <span className="t-num shrink-0 text-bone-dim">{fill(d.n === 1 ? p.demandOne : p.demandMany, { n: d.n })}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
