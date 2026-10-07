"use client";

import Link from "next/link";

import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";

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
      <div className="mx-5 mt-10 rounded-[18px] border border-dashed border-line-strong p-5">
        <p className="p-display text-[1.6rem]">✈ {p.yourCity}</p>
        <p className="mt-2 text-[0.92rem] text-bone/80">{p.anywhere}</p>
        {artist.accepting && (
          <Link href={`/${artist.slug}/request`} className="btn btn-primary mt-4">
            {a.cta}
          </Link>
        )}
      </div>
    </div>
  );
}
