"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { fill } from "@/i18n";
import { dateRange } from "@/lib/format";
import { citySlug } from "@/lib/geo";

import { CityRequest } from "../../CityRequest";
import { Waitlist } from "../../Waitlist";
import { locate } from "../cities";
import { frameOf, type Place } from "../frame";
import { PanelHead } from "../Panel";
import { pinsOf } from "../pins";
import { openDays, StopCalendar } from "../StopCalendar";
import type { ExperienceData } from "../types";
import { WorldMap, type MapMode } from "../WorldMap";

/** The leg the map frames: home and every stop that starts within this many days. Later stops wait at the edge. */
const LEG_DAYS = 90;
/** How far the home studio's calendar looks ahead. */
const HOME_DAYS = 41;
/** Where the browser remembers how the map is drawn. */
const MODE_KEY = "map-mode";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (iso: string, n: number) => isoDay(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000));

/**
 * Tour poster: the world flies in to where the artist will be working, home
 * and guest spots pinned and named, then the itinerary as a route. Each stop
 * opens on its dates and a calendar of its days; under it all, the invitation
 * to name your city with the cities already asking.
 */
export function Spots({ data }: { data: ExperienceData }) {
  const { artist, t, locale, stops } = data;
  const a = t.artist;
  const p = a.panel.spots;
  const d = p.detail;
  const next = stops.find((s) => !s.is_home && s.status !== "done");
  const max = Math.max(1, ...data.demand.map((x) => x.n));
  const today = isoDay(new Date());
  const [picked, setPicked] = useState<string | null>(null);
  const items = useRef<Record<string, HTMLLIElement | null>>({});
  const scrollTo = useRef<string | null>(null);

  // Paper by default; the browser remembers which drawing the viewer last chose.
  const [mode, setMode] = useState<MapMode>("paper");
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (m === "paper" || m === "ink") setMode(m);
    } catch {}
  }, []);
  const choose = (m: MapMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  const pins = useMemo(() => pinsOf(data), [data]);
  // The frame: home plus the stops of the coming months; if nothing is that close, the next one.
  const frame = useMemo(() => {
    const horizon = plusDays(today, LEG_DAYS);
    const dated = pins.filter((x) => x.kind === "stop" && x.on);
    const soon = dated.filter((x) => (x.on as string) <= horizon);
    const leg = [...pins.filter((x) => x.kind === "home" || !x.on), ...(soon.length ? soon : dated.slice(0, 1))];
    const places = leg.flatMap<Place>((x) => {
      const at = locate(x.city);
      return at ? [{ lat: at[0], lon: at[1], country: x.country }] : [];
    });
    return frameOf(places);
  }, [pins, today]);

  const pick = (id: string, fromMap = false) => {
    const open = picked === id ? null : id;
    setPicked(open);
    if (fromMap && open) scrollTo.current = open;
  };

  // A pin on the map opens the stop in the route and brings it into view.
  useEffect(() => {
    const id = scrollTo.current;
    if (!id || id !== picked) return;
    scrollTo.current = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items.current[id]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [picked]);

  return (
    <div className="pb-16">
      <PanelHead id="spots" kicker={a.deck.cards.spots.kicker} title={a.deck.cards.spots.title} lead={p.lead} />

      {/* How to read it, and how to draw it: by hand on paper, or in the deck's gold. */}
      <div className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="max-w-[34ch] text-[0.8rem] text-bone-dim">{p.hint}</p>
        <div className="seg" role="group" aria-label={p.mode.label}>
          <button type="button" className="p-stamp" aria-pressed={mode === "paper"} onClick={() => choose("paper")}>
            {p.mode.paper}
          </button>
          <button type="button" className="p-stamp" aria-pressed={mode === "ink"} onClick={() => choose("ink")}>
            {p.mode.ink}
          </button>
        </div>
      </div>

      {/* The region: the land, the states or borders, the home, the stops. */}
      <figure data-mode={mode} className="wm-figure relative mx-5 overflow-hidden rounded-[22px] border border-line px-3 pt-5 pb-4">
        {mode === "paper" ? <div className="p-grain" aria-hidden /> : <div className="p-halftone" aria-hidden />}
        <WorldMap
          pins={pins}
          frame={frame}
          active={picked}
          onPick={(id) => pick(id, true)}
          label={p.mapLabel}
          later={p.later}
          mode={mode}
          labels={{ zoomIn: p.zoomIn, zoomOut: p.zoomOut, world: p.world }}
          className="w-full"
        />
        <figcaption className="relative mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
          <span className="flex items-center gap-2 text-[0.8rem] text-bone/80">
            <span aria-hidden className="wm-dot inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            {stops.length} {a.deck.cards.spots.title.toLowerCase()}
          </span>
          {next && (
            <span className="p-gothic text-[1.05rem] text-accent">
              {next.city} · {dateRange(next.starts_on, next.ends_on, locale)}
            </span>
          )}
        </figcaption>
      </figure>

      {/* The route: each stop opens on its details and its days. */}
      {stops.length === 0 ? (
        <p className="mt-8 px-5 text-bone-dim">{p.empty}</p>
      ) : (
        <ol className="relative mt-8 ml-5 border-l-2 border-line pl-6 pr-5">
          {stops.map((s, i) => {
            const tone = s.status === "booking" ? "text-accent" : s.status === "full" ? "text-oxblood" : "text-bone-dim";
            const open = picked === s.id;
            const taken = new Set(data.taken[s.id] ?? []);
            const span = s.is_home ? { start: today, end: plusDays(today, HOME_DAYS) } : s.starts_on ? { start: s.starts_on, end: s.ends_on ?? s.starts_on } : null;
            const free = span && s.status !== "full" ? openDays(span.start, span.end, taken, today) : 0;
            return (
              <li key={s.id} ref={(el) => void (items.current[s.id] = el)} className="relative scroll-mt-4 pb-9 last:pb-0">
                {/* the stop on the line */}
                <span aria-hidden className={`absolute top-[0.85rem] -left-[calc(1.5rem+5px)] h-2.5 w-2.5 rounded-full ${s.is_home ? "bg-bone shadow-[0_0_10px_var(--color-bone)]" : "bg-accent shadow-[0_0_10px_var(--accent)]"}`} />
                <button type="button" onClick={() => pick(s.id)} aria-expanded={open} aria-controls={`stop-${s.id}`} className="group flex w-full items-start justify-between gap-4 text-left">
                  <div className="min-w-0">
                    <p className="p-gothic text-[1.15rem] text-bone-dim">
                      {String(i + 1).padStart(2, "0")} · {s.is_home ? a.home : s.country}
                    </p>
                    <p className={`p-display mt-1 text-[clamp(2.8rem,13vw,5rem)] leading-[0.88] transition-colors duration-300 ${open ? "text-accent" : "group-hover:text-bone/80"}`}>{s.city}</p>
                    <p className="p-quote mt-2 text-[1.25rem] text-bone/85">{s.is_home ? s.studio_name : dateRange(s.starts_on, s.ends_on, locale)}</p>
                    {!s.is_home && s.studio_name && <p className="p-stamp mt-1 text-bone-dim">{s.studio_name}</p>}
                  </div>
                  <span className="mt-2 flex shrink-0 flex-col items-end gap-2">
                    <span className={`p-stamp rounded-full border border-current px-2.5 py-1 text-[0.6rem] ${tone}`}>{a.status[s.status]}</span>
                    <span aria-hidden className={`text-[1.1rem] leading-none text-bone-dim transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
                      +
                    </span>
                  </span>
                </button>

                {!s.is_home && (
                  <Link href={`/city/${citySlug(s.city)}`} className="p-stamp mt-2 inline-flex min-h-11 items-center text-bone-dim underline decoration-bone/30 underline-offset-4 hover:text-bone">
                    {fill(p.othersIn, { city: s.city })} →
                  </Link>
                )}

                {/* The detail, growing out of the stop. */}
                <div id={`stop-${s.id}`} className="grid transition-[grid-template-rows] duration-500 ease-[var(--ease-out-quart)]" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                  <div className="min-h-0 overflow-hidden" inert={!open}>
                    <div className="relative mt-5 overflow-hidden rounded-[18px] border border-line bg-ink-2 p-4 sm:p-5">
                      <div className="p-halftone" aria-hidden />
                      <dl className="relative grid grid-cols-2 gap-x-4 gap-y-3 text-[0.95rem]">
                        {s.studio_name && (
                          <div>
                            <dt className="p-stamp text-bone-dim">{d.studio}</dt>
                            <dd className="mt-0.5 text-bone">{s.studio_name}</dd>
                          </div>
                        )}
                        {s.address && (
                          <div>
                            <dt className="p-stamp text-bone-dim">{d.address}</dt>
                            <dd className="mt-0.5 text-bone">{s.address}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="p-stamp text-bone-dim">{d.dates}</dt>
                          <dd className="mt-0.5 text-bone">{s.is_home ? a.home : s.starts_on ? dateRange(s.starts_on, s.ends_on, locale) : a.status.announced}</dd>
                        </div>
                        <div>
                          <dt className="p-stamp text-bone-dim">{d.days}</dt>
                          <dd className={`mt-0.5 ${tone}`}>{s.status === "full" ? a.status.full : span ? (free === 1 ? d.openOne : fill(d.openCount, { n: free })) : a.status[s.status]}</dd>
                        </div>
                      </dl>

                      {span ? (
                        <div className="relative mt-5 border-t border-line pt-4">
                          {s.is_home && <p className="p-stamp mb-3 text-bone-dim">{d.homeDays}</p>}
                          <StopCalendar start={span.start} end={span.end} taken={taken} allTaken={s.status === "full"} locale={locale} labels={{ open: d.open, taken: d.taken }} today={today} />
                          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-bone-dim" aria-hidden>
                            <span className="flex items-center gap-2">
                              <span className="inline-block h-3.5 w-3.5 rounded-full border border-accent bg-accent/15" /> {d.open}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="inline-block w-3.5 border-t-[1.5px] border-oxblood/80" /> {d.taken}
                            </span>
                          </p>
                          {s.status === "full" && <p className="mt-3 max-w-[40ch] text-[0.9rem] text-bone/80">{d.full}</p>}
                        </div>
                      ) : (
                        <p className="relative mt-4 max-w-[40ch] text-[0.95rem] text-bone/80">{d.noDates}</p>
                      )}

                      <div className="relative mt-5 flex flex-wrap items-center gap-3">
                        {s.status === "booking" && artist.accepting && (
                          <Link href={`/${artist.slug}/request`} className="btn btn-accent">
                            {d.reserve}
                          </Link>
                        )}
                        {(s.status === "announced" || s.status === "full") && (
                          <Waitlist
                            artistId={artist.id}
                            stopId={s.id}
                            city={s.city}
                            labels={{ notify: a.notifyMe, title: fill(a.waitlistTitle, { city: s.city }), email: a.waitlistEmail, join: fill(a.waitlistJoin, { city: s.city }) }}
                          />
                        )}
                        <button type="button" className="btn btn-ghost text-bone-dim" onClick={() => setPicked(null)}>
                          {d.close}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
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
            {data.demand.map((x, i) => (
              <li key={x.city} className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-3 text-[0.95rem]">
                <span className="p-gothic text-[1.05rem] text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="relative min-w-0">
                  <span aria-hidden className="absolute inset-y-0 left-0 rounded-sm bg-[linear-gradient(90deg,rgb(212_168_75/0.55),rgb(212_168_75/0.08))]" style={{ width: `${Math.max(8, (x.n / max) * 100)}%` }} />
                  <span className="relative block truncate px-2 py-0.5">{x.city}</span>
                </span>
                <span className="t-num shrink-0 text-bone-dim">{fill(x.n === 1 ? p.demandOne : p.demandMany, { n: x.n })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
