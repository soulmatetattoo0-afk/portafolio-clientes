import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { loadCaja } from "@/lib/caja";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { money, requestTime, sessionTime } from "@/lib/format";
import { getArtistById, listPortfolio, listStops } from "@/lib/queries";
import { Num } from "@/v2/CajaBook";
import { ArtistTabs } from "@/v2/Shell";
import { Sketchbook, type Note } from "@/v2/Sketchbook";

export const metadata = { robots: { index: false } };

/**
 * Sala creativa, in the language of the artist's own page: big tiles over
 * their work, numbered, one block in red. Today on their photo; what waits on
 * them (the red door) and their open chats; the month's Caja; who comes next
 * (or the route, when they guest); the notebook; the settings as tiles.
 */
export default async function RoomPage() {
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room;
  const db = await getDb();
  const nowMs = requestTime();
  const monthKey = new Date(nowMs).toISOString().slice(0, 7);
  const [day, queue, notes, portfolio, stops, caja, visits, visitDays] = await Promise.all([
    db.query<{ id: string; brief_id: string | null; starts_at: Date; timezone: string; hours: number; client: string; style: string | null; city: string | null; today: boolean }>(
      `select ap.id, ap.brief_id, ap.starts_at, ap.timezone, extract(epoch from ap.ends_at - ap.starts_at)::float / 3600 as hours, c.name as client, b.style, ap.city,
              (ap.starts_at at time zone ap.timezone)::date = (now() at time zone ap.timezone)::date as today
         from appointments ap join clients c on c.id = ap.client_id left join briefs b on b.id = ap.brief_id
        where ap.artist_id = $1 and ap.status = 'confirmed' and ap.starts_at >= date_trunc('day', now()) - interval '1 day'
        order by ap.starts_at limit 8`,
      [member.artistId],
    ),
    db.one<{ waiting: number; oldest: Date | null; open: number }>(
      `select (select count(*) from briefs where studio_id = $1 and status = 'new')::int as waiting,
              (select min(created_at) from briefs where studio_id = $1 and status = 'new') as oldest,
              (select count(*) from briefs where studio_id = $1 and status in ('needs_info', 'quoted', 'booked'))::int as open`,
      [member.studioId],
    ),
    db.query<Note>(`select id, body, pinned, done_at is not null as done from artist_notes where artist_id = $1 order by pinned desc, (done_at is not null), created_at desc limit 12`, [member.artistId]),
    listPortfolio(member.artistId, { publishedOnly: true }),
    listStops(member.artistId, { publicOnly: true }),
    loadCaja(db, member.studioId, member.artistId, monthKey),
    // Visits to the artist's page this month, and the same stretch of last month to compare.
    db.one<{ month: number; prev: number; today: number }>(
      `select coalesce(sum(n) filter (where day >= date_trunc('month', current_date)::date), 0)::int as month,
              coalesce(sum(n) filter (where day >= (date_trunc('month', current_date) - interval '1 month')::date and day <= (current_date - interval '1 month')::date), 0)::int as prev,
              coalesce(sum(n) filter (where day = current_date), 0)::int as today
         from page_views where artist_id = $1 and day >= (date_trunc('month', current_date) - interval '1 month')::date`,
      [member.artistId],
    ),
    db.query<{ d: number; n: number }>(`select extract(day from day)::int as d, n from page_views where artist_id = $1 and day >= date_trunc('month', current_date)::date`, [member.artistId]),
  ]);

  const now = new Date(nowMs);
  const todays = day.filter((x) => x.today);
  const upcoming = day.filter((x) => !x.today && new Date(x.starts_at).getTime() > nowMs).slice(0, 4);
  const tz = day[0]?.timezone ?? stops.find((x) => x.is_home)?.timezone ?? "America/New_York";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: tz }).format(now);
  const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(now);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: tz }).format(now);
  const hero = portfolio.find((p) => p.url)?.url ?? artist.portrait_url;
  const guest = stops.filter((x) => !x.is_home);
  const fmt = (c: number) => money(c, artist.currency, locale);
  const profit = caja.totals.income - caja.totals.expenses;
  const bars = caja.bars.map((b) => b.income);
  const barMax = Math.max(1, ...bars);
  const waitingAgo = queue?.oldest ? agoLabel(queue.oldest, locale, nowMs) : null;
  const next = upcoming[0];
  const seen = visits ?? { month: 0, prev: 0, today: 0 };
  const diff = seen.month - seen.prev;
  const todayNum = Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(now));
  const monthDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const perDay = new Map(visitDays.map((v) => [v.d, v.n]));
  const dayMax = Math.max(1, ...visitDays.map((v) => v.n));
  const notebookDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);
  const tiles: [string, string, React.ReactNode, boolean][] = [
    [r.tile.prices, "/studio/sala/precios", <path key="p" d="M3 10l7-7h7v7l-7 7zM13.5 6.5h.01" />, Boolean(artist.default_deposit_cents)],
    [r.tile.styles, "/studio/sala/estilos", <path key="s" d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" />, artist.styles.length > 0],
    [r.tile.care, "/studio/sala/cuidados", <path key="c" d="M10 17s-6-3.6-6-8a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 16 9c0 4.4-6 8-6 8z" />, Boolean(artist.precare && artist.postcare)],
    [r.tile.stripe, "/studio/sala/stripe", <path key="t" d="M3 6h14v9H3zM3 9h14" />, artist.stripe_charges_enabled],
    [r.tile.push, "/studio/sala/avisos", <path key="n" d="M6 14V9a4 4 0 0 1 8 0v5l1.5 1.5h-11zM8.5 17h3" />, true],
    [r.tile.magazine, "/studio/revista", <path key="m" d="M5 3h10v14H5zM8 7h4M8 10h4" />, true],
  ];

  return (
    <div className="poster v2-page min-h-dvh" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2">
        {artist.portrait_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.portrait_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-bone/20" />
        ) : null}
        <h1 className="p-display flex-1 truncate text-[1.9rem] uppercase leading-none">{r.title}</h1>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
        <Link href="/studio/ajustes" className="grid h-10 w-10 place-items-center rounded-full border border-bone/25 text-bone" aria-label={r.settings}>
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
          </svg>
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-2.5 px-3 pt-1 pb-6">
        {/* Today, on their work */}
        <Link href={todays[0]?.brief_id ? `/studio/chats/${todays[0].brief_id}` : "/studio/pagina/fechas"} className="ed-tile block h-[min(56vw,290px)] text-left">
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(10 10 10 / 0.85) 0%, rgb(10 10 10 / 0.45) 55%, rgb(10 10 10 / 0.1) 100%)" }} />
          <span className="relative flex h-full flex-col p-4">
            <span className="p-stamp text-bone/85">
              {r.today} · {weekday}
            </span>
            <span className="mt-1 flex items-baseline gap-2">
              <span className="p-display text-[4.6rem] leading-[0.8] text-bone">{dayNum}</span>
              <span className="p-display text-[1.6rem] uppercase leading-none text-bone/80">{monthName}</span>
            </span>
            <span className="mt-auto">
              {todays.length > 0 ? (
                <>
                  <span className="p-display block text-[1.8rem] uppercase leading-[0.9] text-bone">{fill(todays.length === 1 ? r.oneSession : r.manySessions, { n: todays.length })}</span>
                  <span className="mt-1 block truncate text-[0.85rem] text-bone/85">
                    {todays.map((x) => `${sessionTime(new Date(x.starts_at), x.timezone, locale).time} ${x.client.split(" ")[0]}`).join(" · ")}
                  </span>
                </>
              ) : (
                <>
                  <span className="p-display block text-[1.8rem] uppercase leading-[0.9] text-bone">{r.freeDay}</span>
                  <span className="mt-1 block truncate text-[0.85rem] text-bone/85">
                    {next ? fill(r.nextSession, { when: `${sessionTime(new Date(next.starts_at), next.timezone, locale).day} · ${sessionTime(new Date(next.starts_at), next.timezone, locale).time}`, name: next.client.split(" ")[0] }) : r.noNext}
                  </span>
                </>
              )}
            </span>
          </span>
        </Link>

        {/* 01 · what waits on them (the one red block), 02 · open chats */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/studio/chats?tab=pending" className="ed-tile ed-book block h-40 text-left">
            <span className="relative flex h-full flex-col p-4">
              <Num n={1} tone="ink" />
              <span className="p-display mt-1 text-[3.4rem] leading-[0.85] text-ink tabular-nums">{queue?.waiting ?? 0}</span>
              <span className="p-display mt-auto text-[1.15rem] uppercase leading-[0.95] text-ink">{r.queuePending}</span>
              {waitingAgo && <span className="mt-1 truncate text-[0.72rem] text-ink/75">{fill(r.oldest, { ago: waitingAgo })}</span>}
            </span>
          </Link>
          <Link href="/studio/chats?tab=accepted" className="ed-tile block h-40 text-left">
            <span className="relative flex h-full flex-col p-4">
              <Num n={2} />
              <span className="p-display mt-1 text-[3.4rem] leading-[0.85] text-bone tabular-nums">{queue?.open ?? 0}</span>
              <span className="p-display mt-auto text-[1.15rem] uppercase leading-[0.95] text-bone">{r.openChatsTitle}</span>
            </span>
          </Link>
        </div>

        {/* 03 · who came to see their page this month */}
        <Link href="/studio/pagina" className="ed-tile block text-left">
          <span className="relative block p-4">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <Num n={3} />
                <span className="p-display mt-1 block text-[1.4rem] uppercase leading-none">{r.visits}</span>
              </span>
              <span className="shrink-0 rounded-full bg-bone/10 px-2.5 py-1 text-[0.72rem] text-bone/80">{fill(r.visitsToday, { n: seen.today })}</span>
            </span>
            <span className="mt-2 flex items-baseline gap-2">
              <span className="p-display text-[3rem] leading-[0.85] tabular-nums">{seen.month.toLocaleString(locale)}</span>
              <span className="text-[0.85rem] text-bone/60">{fill(r.visitsMonth, { month: monthName })}</span>
            </span>
            <span className={`mt-1 block text-[0.78rem] ${diff > 0 ? "text-[#b5d1a2]" : diff < 0 ? "text-bone/60" : "text-bone/60"}`}>
              {diff > 0 ? `▲ ${fill(r.visitsUp, { n: diff })}` : diff < 0 ? `▼ ${fill(r.visitsDown, { n: -diff })}` : r.visitsSame}
            </span>
            {/* One bar per day of the month: today in the artist's colour, the days to come as dots. */}
            <span className="mt-3 flex h-9 items-end gap-[3px]" aria-hidden>
              {Array.from({ length: monthDays }, (_, i) => {
                const d = i + 1;
                const n = perDay.get(d) ?? 0;
                return d > todayNum ? (
                  <span key={d} className="h-[3px] flex-1 rounded-full bg-bone/12" />
                ) : (
                  <span key={d} className={`flex-1 rounded-t-[2px] ${d === todayNum ? "bg-accent" : "bg-bone/45"}`} style={{ height: `${Math.max(6, (n / dayMax) * 100)}%` }} />
                );
              })}
            </span>
          </span>
        </Link>

        {/* 04 · Caja */}
        <Link href="/studio/sala/caja" className="ed-tile block text-left">
          <span className="relative flex items-end justify-between gap-4 p-4">
            <span className="min-w-0">
              <Num n={4} />
              <span className="p-display mt-1 block text-[1.4rem] uppercase leading-none">{fill(r.cajaOf, { month: monthName })}</span>
              <span className="p-display mt-2 block text-[2.6rem] leading-[0.85] tabular-nums">{fmt(profit)}</span>
              <span className="mt-1 block text-[0.75rem] text-bone/60">{fill(r.cajaLine, { income: fmt(caja.totals.income), expenses: fmt(caja.totals.expenses) })}</span>
            </span>
            <span className="flex h-16 shrink-0 items-end gap-1" aria-hidden>
              {bars.map((v, i) => (
                <span key={i} className={`w-2.5 rounded-t-[3px] ${i === bars.length - 1 ? "bg-bone" : "bg-bone/25"}`} style={{ height: `${Math.max(8, (v / barMax) * 100)}%` }} />
              ))}
            </span>
            <span className="absolute right-4 top-4 text-bone/60" aria-hidden>
              →
            </span>
          </span>
        </Link>

        {/* 05 · who comes next, or the route */}
        <section className="ed-tile p-4">
          <span className="relative block">
            <Num n={5} />
            <span className="p-display mt-1 block text-[1.4rem] uppercase leading-none">{guest.length > 0 ? r.route : r.nextSessions}</span>
            {guest.length > 0 ? (
              <ul className="mt-3 grid divide-y divide-bone/10">
                {guest.slice(0, 4).map((x) => (
                  <li key={x.id}>
                    <Link href="/studio/pagina/fechas" className="flex items-center gap-3 py-2.5">
                      <span className="p-display min-w-0 flex-1 truncate text-[1.3rem] uppercase leading-none">{x.city}</span>
                      <span className="shrink-0 text-[0.8rem] text-bone/60">{[x.starts_on, x.ends_on].filter(Boolean).map((d) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))).join(" – ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : upcoming.length === 0 ? (
              <span className="mt-2 block text-[0.9rem] text-bone/60">{r.noNext}</span>
            ) : (
              <ul className="mt-3 grid divide-y divide-bone/10">
                {upcoming.map((x) => {
                  const w = sessionTime(new Date(x.starts_at), x.timezone, locale);
                  return (
                    <li key={x.id}>
                      <Link href={x.brief_id ? `/studio/chats/${x.brief_id}` : "/studio/pagina/fechas"} className="flex items-center gap-3 py-2.5">
                        <span className="w-[4.8rem] shrink-0 text-[0.75rem] leading-tight text-bone/60">{w.day}</span>
                        <span className="min-w-0 flex-1">
                          <span className="p-display block truncate text-[1.25rem] uppercase leading-none">{x.client}</span>
                          <span className="block truncate text-[0.75rem] text-bone/60">{[w.time, x.style ? styleLabel(x.style, locale) : null].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span aria-hidden className="text-bone/40">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </span>
        </section>

        {/* 06 · Notas: the notebook */}
        <section className="mt-2">
          <div className="px-1">
            <Num n={6} />
            <p className="p-display mt-1 text-[1.4rem] uppercase leading-none">{r.workshop}</p>
            <p className="mt-1 text-[0.8rem] text-bone/60">{r.workshopSub}</p>
          </div>
          <div className="mt-6">
            <Sketchbook notes={notes} t={t} today={notebookDay} />
          </div>
        </section>

        {/* 07 · Ajustes */}
        <section className="mt-4">
          <div className="px-1">
            <Num n={7} />
            <p className="p-display mt-1 text-[1.4rem] uppercase leading-none">{r.machines}</p>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2.5">
            {tiles.map(([label, href, icon, ok]) => (
              <li key={label}>
                <Link href={href} className="ed-tile relative grid h-24 content-between p-3">
                  <svg viewBox="0 0 20 20" className="h-[22px] w-[22px] text-bone" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {icon}
                  </svg>
                  <span className="text-[0.82rem] font-semibold">{label}</span>
                  {!ok && <span aria-hidden className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} badge={queue?.waiting} />
    </div>
  );
}

function agoLabel(d: Date | string, locale: string, now: number) {
  const mins = Math.max(1, Math.round((now - new Date(d).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  return mins < 60 ? rtf.format(-mins, "minute") : mins < 48 * 60 ? rtf.format(-Math.round(mins / 60), "hour") : rtf.format(-Math.round(mins / 1440), "day");
}
