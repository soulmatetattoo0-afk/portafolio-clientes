"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { addSession, cancelSession, deleteStop, preparePortfolioUploads, quickStop, setStopCover, toggleDayOff } from "@/app/studio/_legacy/actions";
import { uploadFiles, type Storage } from "@/components/edit/upload";
import { PaperCalendar } from "@/components/front/PaperCalendar";
import { fill, type Dict, type Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { ChatCard } from "@/lib/chat";
import { dateRange } from "@/lib/format";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { Pencil } from "./Work";

export interface Place {
  id: string;
  city: string;
  is_home: boolean;
  studio_name: string | null;
  address: string | null;
  starts_on: string | null;
  ends_on: string | null;
  /** The cover the artist gave this city's calendar. */
  cover_url: string | null;
}
export interface DaySession {
  id: string;
  day: string;
  time: string;
  hours: number;
  client: string;
  note: string | null;
  brief_id: string | null;
  city: string | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const tag = (locale: Locale) => (locale === "es" ? "es-US" : "en-US");

/**
 * Fechas: the cities as tabs, and the month of the chosen one on paper. A
 * client taps a free day to start a request on it. The artist sees the same
 * sheet with the clients' names on their days; a day opens across the phone
 * with everything the client asked for, and "Editar calendario" lets them
 * close days, book someone by hand and add a city's calendar.
 */
export function Dates({
  artist,
  places,
  taken,
  sessions,
  cards,
  closed,
  art,
  quote,
  locale,
  t,
  base,
  owner,
  requestHref,
  startEditing = false,
  storage = null,
}: {
  artist: { slug: string; display_name: string; accent: string | null; accepting: boolean };
  places: Place[];
  taken: Record<string, string[]>;
  sessions: DaySession[];
  cards: Record<string, ChatCard>;
  closed: string[];
  art: string | null;
  quote: string | null;
  locale: Locale;
  t: Dict;
  base: string;
  owner: boolean;
  requestHref: string;
  startEditing?: boolean;
  storage?: Storage | null;
}) {
  const d = t.v2.dates;
  const today = isoToday();
  const router = useRouter();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const place = places.find((p) => p.id === placeId) ?? places[0] ?? null;
  const [day, setDay] = useState<string | null>(null);
  const [editing, setEditing] = useState(startEditing);
  const [addingCity, setAddingCity] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const byDay = useMemo(() => {
    const m = new Map<string, DaySession[]>();
    for (const s of sessions) if (!place || place.is_home || !s.city || s.city.toLowerCase() === place.city.toLowerCase()) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return m;
  }, [sessions, place]);
  const marks = useMemo(() => Object.fromEntries([...byDay].map(([k, v]) => [k, v.length])), [byDay]);
  const closedSet = useMemo(() => new Set(closed), [closed]);
  const longDate = (iso: string) => new Intl.DateTimeFormat(tag(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const run = (fn: () => Promise<{ error?: string } | void | unknown>) =>
    start(async () => {
      setError(null);
      const r = (await fn()) as { error?: string } | void;
      if (r && typeof r === "object" && r.error) setError(r.error);
      else router.refresh();
    });

  const daySessions = day ? (byDay.get(day) ?? []) : [];
  const cover = place?.cover_url ?? art;
  const uploadCover = (file: File | undefined) => {
    if (!file || !place) return;
    run(async () => {
      const up = await uploadFiles(preparePortfolioUploads, [file], storage);
      if (up) await setStopCover(place.id, up.token, up.keys[0]);
    });
  };

  return (
    <div className="poster v2-page min-h-dvh" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="v2-top">
        <Link href={base} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 truncate text-[1.6rem] uppercase leading-none">{d.title}</h1>
        {owner && (
          <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing} className="rounded-full border border-bone/25 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-bone aria-pressed:bg-accent aria-pressed:text-bone aria-pressed:border-accent">
            {editing ? d.view : d.edit}
          </button>
        )}
      </header>

      {/* The cities */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-2 [scrollbar-width:none]" role="tablist">
        {places.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={place?.id === p.id} onClick={() => setPlaceId(p.id)} className={`shrink-0 rounded-full border px-4 py-2 text-left ${place?.id === p.id ? "border-bone bg-bone text-ink" : "border-bone/25 text-bone"}`}>
            <span className="block text-[0.95rem] leading-tight font-semibold">{p.city}</span>
            <span className="block text-[0.7rem] opacity-70">{p.is_home ? d.resident : dateRange(p.starts_on, p.ends_on, locale)}</span>
          </button>
        ))}
        {owner && editing && (
          <button type="button" onClick={() => setAddingCity(true)} className="shrink-0 rounded-full border border-dashed border-accent px-4 py-2 text-[0.85rem] font-semibold text-accent">
            + {d.addCity}
          </button>
        )}
      </div>
      {owner && editing && <p className="px-4 pb-2 text-[0.82rem] text-bone-dim">{d.editHint}</p>}

      {place && (
        <div className="px-4">
          <PaperCalendar
            key={`${place.id}-${editing}`}
            locale={locale}
            labels={{ prevMonth: d.prevMonth, nextMonth: d.nextMonth }}
            taken={new Set(owner ? [] : (taken[place.id] ?? []))}
            marks={owner ? marks : undefined}
            closed={closedSet}
            pickAny={owner}
            monthStart={owner ? `${today.slice(0, 7)}-01` : undefined}
            from={place.is_home ? today : (place.starts_on ?? today)}
            to={place.is_home ? null : (place.ends_on ?? place.starts_on)}
            city={place.city}
            art={cover}
            quote={quote}
            onPick={setDay}
          />
          {owner && editing && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[0.9rem]">{d.cover}</span>
                <span className="block text-[0.75rem] text-bone-dim">{d.coverHint}</span>
              </span>
              <label className={`v2-btn shrink-0 cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`} data-tone="ghost">
                {d.changeCover}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadCover(e.target.files?.[0])} />
              </label>
            </div>
          )}
          {owner && editing && !place.is_home && (
            <button type="button" className="mt-3 text-[0.82rem] text-bone-dim underline underline-offset-4" disabled={pending} onClick={() => run(() => deleteStop(place.id))}>
              {d.removeCity}
            </button>
          )}
        </div>
      )}

      {/* A client's tapped day: book it by sending the request first. */}
      {day && !owner && createPortal(
        <div role="dialog" aria-modal="true" className="poster fixed inset-0 z-[60] grid place-items-end bg-ink/70 p-3 backdrop-blur-sm sm:place-items-center" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }} onClick={() => setDay(null)}>
          <div className="animate-rise w-full max-w-md rounded-[28px] border border-bone/15 bg-ink-2 p-6 text-bone" onClick={(e) => e.stopPropagation()}>
            <p className="p-display text-[2rem] leading-[0.92]">{fill(d.pickTitle, { date: longDate(day) })}</p>
            <p className="mt-3 text-bone/80">{fill(d.pickBody, { artist: artist.display_name })}</p>
            <Link href={`${requestHref}&date=${day}${place && !place.is_home ? `&stop=${place.id}` : ""}`} className="v2-btn mt-6 w-full" data-tone="accent">
              {d.pickCta}
            </Link>
            <button type="button" onClick={() => setDay(null)} className="mt-2 h-11 w-full text-[0.88rem] text-bone-dim">
              {d.close}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* The artist's day: across the phone, with everything the client asked for; in edit mode, the day's switches. */}
      {day && owner && createPortal(
        <DayView
          day={day}
          long={longDate(day)}
          city={place?.city ?? null}
          cover={cover}
          sessions={daySessions}
          cards={cards}
          closed={closedSet.has(day)}
          editing={editing}
          pending={pending}
          error={error}
          t={t}
          locale={locale}
          onClose={() => setDay(null)}
          onToggle={() => run(() => toggleDayOff(day))}
          onAdd={(v) => run(() => addSession({ ...v, date: day }))}
          onCancel={(id) => run(() => cancelSession(id))}
        />,
        document.body,
      )}

      {addingCity && createPortal(
        <CityForm
          t={t}
          pending={pending}
          error={error}
          onClose={() => setAddingCity(false)}
          onSave={(v) =>
            run(async () => {
              const r = await quickStop(null, { ...v, status: "booking" });
              if (!r?.error) setAddingCity(false);
              return r;
            })
          }
        />,
        document.body,
      )}
    </div>
  );
}

function DayView({ day, long, city, cover, sessions, cards, closed, editing, pending, error, t, locale, onClose, onToggle, onAdd, onCancel }: { day: string; long: string; city: string | null; cover: string | null; sessions: DaySession[]; cards: Record<string, ChatCard>; closed: boolean; editing: boolean; pending: boolean; error: string | null; t: Dict; locale: Locale; onClose: () => void; onToggle: () => void; onAdd: (v: { client: string; time: string; hours: number; note: string }) => void; onCancel: (id: string) => void }) {
  const d = t.v2.dates;
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const num = day.slice(8).replace(/^0/, "");
  const month = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const weekday = new Intl.DateTimeFormat(tag(locale), { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const past = day < isoToday();
  const free = sessions.length === 0;
  const many = sessions.length > 1;
  return (
    <div role="dialog" aria-modal="true" aria-label={long} className="poster fixed inset-0 z-[60] overflow-y-auto bg-ink text-bone">
      {/* The city's cover, tinted in the artist's colour; the whole screen when the day is free. */}
      <div className={`v2-duotone absolute inset-x-0 top-0 overflow-hidden ${free ? "h-[100svh]" : many ? "h-[44svh]" : "h-[56svh]"}`} data-closed={closed}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!cover && city && (
          <span aria-hidden className="p-display absolute -left-2 bottom-0 text-[38vw] leading-[0.8] uppercase" style={{ color: "transparent", WebkitTextStroke: "1.5px rgb(11 10 9 / 0.5)" }}>
            {city}
          </span>
        )}
        <span className="p-halftone" aria-hidden style={{ opacity: 0.2, maskImage: "none" }} />
        <span className="p-grain" aria-hidden style={{ opacity: 0.14 }} />
        {!free && <span className="absolute inset-0" aria-hidden style={{ background: "linear-gradient(180deg, transparent 45%, #0b0a09 100%)" }} />}
      </div>

      <div className="relative">
        <div className="flex items-center gap-3 px-3 pt-[max(env(safe-area-inset-top),0.6rem)]">
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center" aria-label={d.close}>
            <span aria-hidden className="text-[1.4rem]">←</span>
          </button>
          <span className="flex items-center gap-2 text-[0.62rem] font-medium tracking-[0.12em] text-bone/85">
            03
            <span className="h-px w-8 bg-bone/70" />
          </span>
          <span className="p-stamp text-bone/85">{weekday}</span>
        </div>

        {city && (
          <p className="mt-[8svh] flex items-center gap-1.5 px-5 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-bone">
            <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" />
            </svg>
            {city}
          </p>
        )}

        {free ? (
          <div className="grid min-h-[70svh] place-items-center px-5 text-center">
            <div>
              <p className="p-display text-[62vw] leading-[0.78]">{num}</p>
              <p className="p-display -mt-2 text-[2.6rem] uppercase leading-none" style={{ color: "transparent", WebkitTextStroke: "1.5px var(--color-bone)" }}>
                {month}
              </p>
              <p className={`v2-rubber p-display mt-6 text-[1.6rem] uppercase leading-none`} data-tone={closed ? "accent" : undefined}>
                {closed ? d.closedStamp : d.freeStamp}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-3 px-5">
            <p className={`p-display leading-[0.78] ${many ? "text-[48vw]" : "text-[62vw]"}`} style={{ marginBottom: "-0.12em" }}>
              {num}
            </p>
            <div className="mb-[0.9em] min-w-0">
              <p className="p-display text-[2.6rem] uppercase leading-none" style={{ color: "transparent", WebkitTextStroke: "1.5px var(--color-bone)" }}>
                {month}
              </p>
              {many && <span className="mt-2 inline-block rounded-full border border-bone/70 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]">{fill(d.sessions, { n: sessions.length })}</span>}
            </div>
          </div>
        )}

        {/* The tickets, one per session, the second tucked under the first like a stub book. */}
        {!free && (
          <div className="relative px-3 pb-32">
            {many && <span aria-hidden className="absolute left-[1.9rem] top-8 bottom-32 w-px bg-bone/30" />}
            {sessions.map((s, k) => {
              const card = s.brief_id ? cards[s.brief_id] : null;
              const placement = card ? PLACEMENT_BY_SLUG.get(card.placement)?.label[locale] : null;
              const refs = card?.files.slice(0, 3) ?? [];
              return (
                <article key={s.id} className="v2-ticket px-5 pt-5" style={{ zIndex: 10 - k }}>
                  <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="p-display text-[3.4rem] leading-[0.85] tabular-nums">{s.time}</p>
                        <p className="p-stamp mt-1 text-[#2b2420]/70">
                          {fill(d.hoursShort, { n: Math.round(s.hours * 10) / 10 })}
                          {!s.brief_id && ` · ${d.manual}`}
                        </p>
                      </div>
                      {card && <span className="p-stamp shrink-0 rounded-full border-[1.5px] border-[#2b2420] px-2.5 py-1 text-[#2b2420]">{styleLabel(card.style, locale)}</span>}
                    </div>
                    <p className="p-display mt-3 text-[2.2rem] leading-[0.9] uppercase">{s.client}</p>
                    {placement && <p className="p-stamp mt-1 text-[#2b2420]/70">{placement}{card?.city ? ` · ${card.city}` : ""}</p>}
                    {s.note && <p className="mt-2 text-[0.95rem] text-[#2b2420]/85">{s.note}</p>}
                    {card && <p className={`p-quote mt-3 text-[1.15rem] text-[#2b2420]/85 ${many ? "line-clamp-3" : "line-clamp-4"}`}>{card.description}</p>}
                    {refs.length > 0 && (
                      <ul className="mt-4 flex gap-3">
                        {refs.map((f, i) => (
                          <li key={f.id} style={{ rotate: `${[-2, 1, -1][i]}deg` }}>
                            <button type="button" onClick={() => setOpen(f.url)} className="block aspect-[4/5] w-[26vw] max-w-[120px] overflow-hidden rounded-[10px] bg-[#d9d0bf]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" style={{ mixBlendMode: "multiply", filter: "saturate(0.9) contrast(1.05)" }} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {editing && !past && (
                      <div className="mt-4">
                        {cancelling === s.id ? (
                          <div className="grid gap-2 rounded-[14px] border border-[#2b2420]/30 p-3">
                            <p className="text-[0.9rem]">{d.cancelConfirm}</p>
                            <div className="flex gap-2">
                              <button type="button" className="v2-btn bg-[#2b2420] text-[#ece4d4]" disabled={pending} onClick={() => onCancel(s.id)}>
                                {d.cancelSession}
                              </button>
                              <button type="button" className="v2-btn border border-[#2b2420]/40 text-[#2b2420]" onClick={() => setCancelling(null)}>
                                {t.common.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" className="text-[0.85rem] text-[#2b2420]/70 underline underline-offset-4" onClick={() => setCancelling(s.id)}>
                            {d.cancelSession}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="v2-perf mt-5" aria-hidden />
                    {/* The stub */}
                    <div className="-mx-5 bg-[#e4dbc9] px-5 pt-4 pb-5">
                      {s.brief_id ? (
                        <Link href={`/studio/chats/${s.brief_id}`} className="flex h-14 items-center justify-between rounded-full bg-accent pl-5 pr-2 text-bone">
                          <span className="p-display text-[1.3rem] uppercase leading-none">{fill(d.chatWith, { name: s.client.split(" ")[0] })}</span>
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-bone">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 12h16M14 6l6 6-6 6" />
                            </svg>
                          </span>
                        </Link>
                      ) : null}
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <span className="p-stamp text-[#2b2420]/70">{fill(d.ticket, { ref: card?.ref ?? s.id.slice(0, 4).toUpperCase() })}</span>
                        <span className="v2-barcode w-[38%]" aria-hidden />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Edit mode: the day's switches, as pills at the foot. */}
        {editing && !past && (
          <div className={`${free ? "absolute inset-x-0 bottom-0" : "-mt-24 relative"} px-3 pb-[max(env(safe-area-inset-bottom),1rem)]`}>
            {adding ? (
              <form
                className="v2-sheet grid gap-3 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  onAdd({ client: String(f.get("client") ?? ""), time: String(f.get("time") ?? "12:00"), hours: Number(f.get("hours") ?? 3), note: String(f.get("note") ?? "") });
                  setAdding(false);
                }}
              >
                <label className="v2-field">
                  <span>{d.client}</span>
                  <input name="client" required maxLength={120} className="v2-input" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="v2-field">
                    <span>{d.time}</span>
                    <input name="time" type="time" defaultValue="12:00" required className="v2-input" />
                  </label>
                  <label className="v2-field">
                    <span>{d.hours}</span>
                    <input name="hours" type="number" min={0.5} max={14} step={0.5} defaultValue={3} className="v2-input" />
                  </label>
                </div>
                <label className="v2-field">
                  <span>{d.note}</span>
                  <input name="note" maxLength={500} className="v2-input" />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="v2-btn" data-tone="accent" disabled={pending}>
                    {d.save}
                  </button>
                  <button type="button" className="v2-btn" data-tone="ghost" onClick={() => setAdding(false)}>
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="v2-btn bg-bone text-ink" onClick={() => setAdding(true)}>
                  + {d.addSession}
                </button>
                <button type="button" className="v2-btn bg-bone text-ink" disabled={pending} onClick={onToggle}>
                  {closed ? d.openDay : d.closeDay}
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[0.88rem] text-accent">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {open && (
        <button type="button" className="fixed inset-0 z-[70] grid place-items-center bg-ink/95 p-4" onClick={() => setOpen(null)} aria-label={t.common.close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="" className="max-h-full max-w-full rounded-[14px] object-contain" />
        </button>
      )}
    </div>
  );
}

function CityForm({ t, pending, error, onClose, onSave }: { t: Dict; pending: boolean; error: string | null; onClose: () => void; onSave: (v: Record<string, string>) => void }) {
  const d = t.v2.dates;
  return (
    <div role="dialog" aria-modal="true" className="poster fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <form
        className="animate-rise w-full max-w-[440px] rounded-t-[1.6rem] border border-line bg-ink-2 px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-bone sm:rounded-[1.6rem]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave(Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])));
        }}
      >
        <p className="p-display text-[1.6rem] leading-none">{d.addCity}</p>
        <div className="mt-4 grid gap-3">
          <label className="v2-field">
            <span>{d.city}</span>
            <input name="city" required maxLength={80} className="v2-input" />
          </label>
          <label className="v2-field">
            <span>{d.studio}</span>
            <input name="studio_name" maxLength={120} className="v2-input" />
          </label>
          <label className="v2-field">
            <span>{d.address}</span>
            <input name="address" maxLength={200} className="v2-input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="v2-field">
              <span>{d.from}</span>
              <input name="starts_on" type="date" required className="v2-input" />
            </label>
            <label className="v2-field">
              <span>{d.to}</span>
              <input name="ends_on" type="date" required className="v2-input" />
            </label>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[0.88rem] text-accent">
            {error}
          </p>
        )}
        <button type="submit" className="v2-btn mt-5 w-full" data-tone="accent" disabled={pending}>
          {d.save}
        </button>
        <button type="button" onClick={onClose} className="mt-2 h-11 w-full text-[0.88rem] text-bone-dim">
          {t.common.cancel}
        </button>
      </form>
    </div>
  );
}

export { Pencil };
