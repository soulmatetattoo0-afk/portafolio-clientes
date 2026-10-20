import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { money, requestTime, sessionTime } from "@/lib/format";
import { getArtistById, listPortfolio, listStops } from "@/lib/queries";
import { CallSheet } from "@/v2/CallSheet";
import { Sketchbook, type Note } from "@/v2/Sketchbook";
import { Caja, type CajaBar, type CajaMove } from "@/v2/Caja";
import { ArtistTabs } from "@/v2/Shell";

export const metadata = { robots: { index: false } };

/**
 * Sala creativa: the artist's desk. From what to do now to what they make,
 * then the numbers and the machinery: 01 today's call sheet, 02 the queue,
 * 03 the sketchbook, 04 next steps for the page, 05 the work as a film strip,
 * 06 the route, 07 the month as a funnel, 08 Caja, 09 the engine room.
 */
export default async function RoomPage() {
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room;
  const s = t.v2.settings;
  const db = await getDb();
  const [stats, months, pays, exps, day, queue, notes, portfolio, stops, signals] = await Promise.all([
    db.one<{ income: number; income_prev: number; deposits: number; sessions: number; expenses: number; bookings: number; quotes: number; quotes_prev: number; visits: number; followers: number; pending: number; response_min: number | null }>(
      `select
        coalesce((select sum(p.amount_cents - coalesce(p.application_fee_cents, 0)) from payments p where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and p.created_at >= date_trunc('month', now())), 0)::int as income,
        coalesce((select sum(p.amount_cents - coalesce(p.application_fee_cents, 0)) from payments p where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and p.created_at >= date_trunc('month', now()) - interval '1 month' and p.created_at < date_trunc('month', now())), 0)::int as income_prev,
        coalesce((select sum(p.amount_cents - coalesce(p.application_fee_cents, 0)) from payments p where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and p.kind = 'deposit' and p.created_at >= date_trunc('month', now())), 0)::int as deposits,
        coalesce((select sum(p.amount_cents - coalesce(p.application_fee_cents, 0)) from payments p where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and p.kind = 'balance' and p.created_at >= date_trunc('month', now())), 0)::int as sessions,
        coalesce((select sum(e.amount_cents) from expenses e where e.artist_id = $2 and e.day >= date_trunc('month', now())::date), 0)::int as expenses,
        (select count(*) from appointments ap where ap.artist_id = $2 and ap.status in ('confirmed', 'completed') and ap.created_at >= date_trunc('month', now()))::int as bookings,
        (select count(*) from briefs b where b.studio_id = $1 and b.created_at >= date_trunc('month', now()))::int as quotes,
        (select count(*) from briefs b where b.studio_id = $1 and b.created_at >= date_trunc('month', now()) - interval '1 month' and b.created_at < date_trunc('month', now()))::int as quotes_prev,
        coalesce((select sum(n) from page_views v where v.artist_id = $2 and v.day >= date_trunc('month', now())::date), 0)::int as visits,
        (select count(*) from follows f where f.artist_id = $2)::int as followers,
        (select count(*) from briefs b where b.studio_id = $1 and b.status = 'new')::int as pending,
        (select avg(extract(epoch from (e.first - b.created_at)) / 60)::float from briefs b
           join lateral (select min(created_at) as first from brief_events e where e.brief_id = b.id and e.actor = 'artist') e on true
          where b.studio_id = $1 and b.created_at >= now() - interval '60 days' and e.first is not null) as response_min`,
      [member.studioId, member.artistId],
    ),
    db.query<{ m: string; income: number; expense: number }>(
      `select to_char(d, 'YYYY-MM') as m,
              coalesce((select sum(p.amount_cents - coalesce(p.application_fee_cents, 0)) from payments p where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and date_trunc('month', p.created_at) = d), 0)::int as income,
              coalesce((select sum(e.amount_cents) from expenses e where e.artist_id = $2 and date_trunc('month', e.day::timestamp) = d), 0)::int as expense
         from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as d order by d`,
      [member.studioId, member.artistId],
    ),
    db.query<{ id: string; kind: "deposit" | "balance"; cents: number; day: string; who: string; note: string | null }>(
      `select p.id, p.kind, (p.amount_cents - coalesce(p.application_fee_cents, 0))::int as cents, to_char(p.created_at, 'YYYY-MM-DD') as day,
              c.name as who, b.style as note
         from payments p join quotes q on q.id = p.quote_id join briefs b on b.id = q.brief_id join clients c on c.id = b.client_id
        where p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%' and p.created_at >= now() - interval '90 days'`,
      [member.studioId],
    ),
    db.query<{ id: string; cents: number; day: string; who: string }>(`select id, amount_cents as cents, to_char(day, 'YYYY-MM-DD') as day, label as who from expenses where artist_id = $1 and day >= current_date - 90`, [member.artistId]),
    // 01 · today's sessions on the studio's clock, and the next one after today.
    db.query<{ id: string; brief_id: string | null; starts_at: Date; timezone: string; hours: number; client: string; style: string | null; city: string | null; today: boolean }>(
      `select ap.id, ap.brief_id, ap.starts_at, ap.timezone, extract(epoch from ap.ends_at - ap.starts_at)::float / 3600 as hours, c.name as client, b.style, ap.city,
              (ap.starts_at at time zone ap.timezone)::date = (now() at time zone ap.timezone)::date as today
         from appointments ap join clients c on c.id = ap.client_id left join briefs b on b.id = ap.brief_id
        where ap.artist_id = $1 and ap.status = 'confirmed' and ap.starts_at >= date_trunc('day', now()) - interval '1 day'
        order by ap.starts_at limit 6`,
      [member.artistId],
    ),
    // 02 · what waits on the artist: new quotes, open chats, balances to collect.
    db.one<{ waiting: number; oldest: Date | null; open: number; to_collect: number; to_collect_cents: number }>(
      `select (select count(*) from briefs where studio_id = $1 and status = 'new')::int as waiting,
              (select min(created_at) from briefs where studio_id = $1 and status = 'new') as oldest,
              (select count(*) from briefs where studio_id = $1 and status in ('needs_info', 'quoted'))::int as open,
              (select count(*) from appointments ap where ap.studio_id = $1 and ap.status in ('confirmed', 'completed') and ap.starts_at < now()
                  and not exists (select 1 from payments p where p.appointment_id = ap.id and p.kind = 'balance' and p.status = 'paid'))::int as to_collect,
              coalesce((select sum(ap.balance_cents) from appointments ap where ap.studio_id = $1 and ap.status in ('confirmed', 'completed') and ap.starts_at < now()
                  and not exists (select 1 from payments p where p.appointment_id = ap.id and p.kind = 'balance' and p.status = 'paid')), 0)::int as to_collect_cents`,
      [member.studioId],
    ),
    db.query<Note>(`select id, body, pinned, done_at is not null as done from artist_notes where artist_id = $1 order by pinned desc, (done_at is not null), created_at desc limit 12`, [member.artistId]),
    listPortfolio(member.artistId, { publishedOnly: true }),
    listStops(member.artistId, { publicOnly: true }),
    db.one<{ magazine: boolean; last_piece: Date | null; push: boolean }>(
      `select (a.magazine is not null) as magazine, (select max(created_at) from portfolio_items where artist_id = a.id) as last_piece,
              exists (select 1 from push_subscriptions ps join members m on m.user_id = ps.user_id where m.studio_id = a.studio_id) as push
         from artists a where a.id = $1`,
      [member.artistId],
    ),
  ]);
  const monthName = (ym: string) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`)).replace(".", "");
  const now = new Date().toISOString().slice(0, 7);
  const bars: CajaBar[] = months.map((m) => ({ label: monthName(m.m), income: m.income, expense: m.expense, current: m.m === now }));
  const moves: CajaMove[] = [
    ...pays.map((p) => ({ id: p.id, kind: p.kind, who: p.who, note: p.note ? styleLabel(p.note, locale) : null, cents: p.cents, day: p.day })),
    ...exps.map((e) => ({ id: e.id, kind: "expense" as const, who: e.who, note: null, cents: e.cents, day: e.day })),
  ].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const conversion = stats && stats.quotes > 0 ? Math.round((stats.bookings / stats.quotes) * 100) : null;
  const response = stats?.response_min == null ? s.none : stats.response_min < 90 ? fill(s.mins, { n: Math.round(stats.response_min) }) : stats.response_min < 48 * 60 ? fill(s.hoursShort, { n: Math.round(stats.response_min / 60) }) : fill(s.days, { n: Math.round(stats.response_min / 1440) });
  const nowMs = requestTime();
  // 06 · the route: each upcoming city with its booked sessions and free days.
  const routeRows = await Promise.all(
    stops.slice(0, 5).map(async (st) => {
      const n = await db.one<{ n: number }>(
        `select count(*)::int as n from appointments where artist_id = $1 and status in ('confirmed', 'completed') and lower(coalesce(city, '')) = lower($2) and starts_at >= now()`,
        [member.artistId, st.city],
      );
      const span = st.starts_on && st.ends_on ? Math.round((new Date(st.ends_on).getTime() - new Date(st.starts_on).getTime()) / 86400000) + 1 : null;
      return { ...st, sessions: n?.n ?? 0, free: span !== null ? Math.max(0, span - (n?.n ?? 0)) : null };
    }),
  );
  // 04 · the page's next steps, the ones that matter most first.
  const pieces = portfolio.filter((x) => x.url);
  const perStyle = Object.entries(pieces.reduce<Record<string, number>>((m, x) => ((m[x.style ?? "other"] = (m[x.style ?? "other"] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const steps: [string, string][] = [];
  if (!artist.stripe_charges_enabled) steps.push([r.step.stripe, "/studio/ajustes"]);
  if (stats?.response_min != null && stats.response_min > 24 * 60) steps.push([r.step.response, "/studio/chats?tab=pending"]);
  if (!artist.precare || !artist.postcare) steps.push([r.step.care, "/studio/ajustes"]);
  if (!artist.default_deposit_cents) steps.push([r.step.deposit, "/studio/ajustes"]);
  if (!signals?.magazine) steps.push([r.step.cover, "/studio/revista"]);
  if (signals?.last_piece && nowMs - new Date(signals.last_piece).getTime() > 21 * 86400000) steps.push([r.step.work, "/studio/obras"]);
  if (perStyle.some(([, n]) => n < 6)) steps.push([r.step.style, "/studio/obras"]);
  if (!artist.headline) steps.push([r.step.headline, "/studio/ajustes"]);
  if (!stops.some((x) => !x.is_home)) steps.push([r.step.city, "/studio/pagina/fechas?edit=1"]);
  const checks = 9;
  const score = Math.round(((checks - steps.length) / checks) * 100);
  // 01 · the call sheet.
  const now0 = new Date(nowMs);
  const dayOfYear = Math.floor((Date.UTC(now0.getUTCFullYear(), now0.getUTCMonth(), now0.getUTCDate()) - Date.UTC(now0.getUTCFullYear(), 0, 0)) / 86400000);
  const todays = day.filter((x) => x.today);
  const next = day.find((x) => !x.today && new Date(x.starts_at).getTime() > nowMs);
  const tz = day[0]?.timezone ?? stops.find((x) => x.is_home)?.timezone ?? "America/New_York";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: tz }).format(now0);
  const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(now0);
  const homeCity = stops.find((x) => x.is_home)?.city ?? artist.home_city ?? "";
  const ago = queue?.oldest ? relativeAgo(queue.oldest, locale, nowMs) : null;
  // 07 · the funnel.
  const funnel: [string, number][] = [
    [s.visits, stats?.visits ?? 0],
    [s.quotes, stats?.quotes ?? 0],
    [s.bookings, stats?.bookings ?? 0],
  ];
  const fmax = Math.max(1, ...funnel.map(([, v]) => Math.sqrt(v)));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(now0);
  const tiles: [string, string, React.ReactNode, boolean][] = [
    [r.tile.prices, "/studio/ajustes", <path key="p" d="M3 10l7-7h7v7l-7 7zM13.5 6.5h.01" />, Boolean(artist.default_deposit_cents)],
    [r.tile.styles, "/studio/ajustes", <path key="s" d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" />, artist.styles.length > 0],
    [r.tile.care, "/studio/ajustes", <path key="c" d="M10 17s-6-3.6-6-8a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 16 9c0 4.4-6 8-6 8z" />, Boolean(artist.precare && artist.postcare)],
    [r.tile.stripe, "/studio/ajustes", <path key="t" d="M3 6h14v9H3zM3 9h14" />, artist.stripe_charges_enabled],
    [r.tile.push, "/studio/ajustes", <path key="n" d="M6 14V9a4 4 0 0 1 8 0v5l1.5 1.5h-11zM8.5 17h3" />, Boolean(signals?.push)],
    [r.tile.magazine, "/studio/revista", <path key="m" d="M5 3h10v14H5zM8 7h4M8 10h4" />, Boolean(signals?.magazine)],
  ];

  return (
    <div className="v2-page min-h-dvh">
      <header className="v2-top">
        {artist.portrait_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.portrait_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : null}
        <h1 className="p-display flex-1 truncate text-[1.8rem] uppercase leading-none">{r.title}</h1>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
        <Link href="/studio/ajustes" className="grid h-10 w-10 place-items-center rounded-full border border-bone/25 text-bone" aria-label={r.settings}>
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
          </svg>
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-10 px-3 pt-4 pb-6">
        {/* 01 · Hoy: the day's sheet, printed out of the slot. */}
        <section className="v2-block min-w-0">
          <Head n={1} title={r.today} sub={`${weekday} · ${homeCity}`} />
          <div className="relative mt-4">
            <CallSheet day={now0.toISOString().slice(0, 10)}>
              <div className="v2-callsheet">
                <span className="v2-tape" aria-hidden />
                <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <p className="p-stamp text-[#2b2420]/60">{fill(r.sheet, { n: dayOfYear })}</p>
                    <p className="p-display text-[5.5rem] leading-[0.8] tabular-nums">{dayNum}</p>
                  </div>
                  {todays.length > 0 ? (
                    <ul className="mt-3 grid">
                      {todays.map((x) => {
                        const w = sessionTime(new Date(x.starts_at), x.timezone, locale);
                        return (
                          <li key={x.id} className="border-t border-[#2b2420]/20 py-2.5">
                            <Link href={x.brief_id ? `/studio/chats/${x.brief_id}` : "/studio/pagina/fechas"} className="flex items-center gap-3">
                              <span className="p-display w-[5.2rem] shrink-0 text-[1.7rem] leading-none tabular-nums">{w.time}</span>
                              <span className="min-w-0 flex-1">
                                <span className="p-display block truncate text-[1.35rem] uppercase leading-none">{x.client}</span>
                                <span className="p-stamp text-[#2b2420]/60">{[x.style ? styleLabel(x.style, locale) : null, `${Math.round(x.hours * 10) / 10} h`].filter(Boolean).join(" · ")}</span>
                              </span>
                              <span aria-hidden>›</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="v2-rubber p-display border-[#2b2420] text-[1.4rem] uppercase leading-none text-[#2b2420]">{r.freeDay}</span>
                      <span className="text-[0.92rem] text-[#2b2420]/80">
                        {next ? fill(r.nextSession, { when: `${sessionTime(new Date(next.starts_at), next.timezone, locale).day} · ${sessionTime(new Date(next.starts_at), next.timezone, locale).time}`, name: next.client.split(" ")[0] }) : r.noNext}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CallSheet>
          </div>
        </section>

        {/* 02 · La cola: the band in the artist's colour. */}
        <section className="v2-block min-w-0">
          <Head n={2} title={r.queue} />
          <Link href="/studio/chats?tab=pending" className="ed-tile ed-book mt-4 block h-24">
            <span className="relative flex h-full items-center justify-between gap-3 px-5">
              <span className="min-w-0">
                <span className="p-display block text-[1.9rem] uppercase leading-[0.9] text-ink">{queue?.waiting ? (queue.waiting === 1 ? r.waitingOne : fill(r.waiting, { n: queue.waiting })) : r.noQueue}</span>
                {ago && <span className="p-stamp mt-1 block text-ink/75">{fill(r.oldest, { ago })}</span>}
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-bone" aria-hidden>
                →
              </span>
            </span>
          </Link>
          <p className="mt-2 px-1 text-[0.88rem] text-bone-dim">
            {queue?.open === 1 ? r.openChat1 : fill(r.openChats, { n: queue?.open ?? 0 })}
            {queue && queue.to_collect > 0 ? ` · ${fill(r.toCollect, { n: queue.to_collect, amount: money(queue.to_collect_cents, artist.currency, locale) })}` : ""}
          </p>
        </section>

        {/* 03 · Taller: the sketchbook. */}
        <section className="v2-block min-w-0">
          <Head n={3} title={r.workshop} sub={r.workshopSub} />
          <div className="mt-4">
            <Sketchbook notes={notes} t={t} />
          </div>
        </section>

        {/* 04 · Próximos pasos: a printer's proof with the page's score. */}
        <section className="v2-block min-w-0">
          <Head n={4} title={r.steps} sub={r.stepsSub} />
          <div className="v2-proof mt-4 flex items-start gap-4 rounded-[22px] border border-bone/10">
            <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] shrink-0" aria-label={`${r.score} ${score}%`} role="img">
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgb(239 231 216 / 0.15)" strokeWidth="5" />
              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--color-bone)" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${score} 100`} transform="rotate(-90 36 36)" />
              <text x="36" y="40" textAnchor="middle" fontSize="15" fill="var(--color-bone)" fontFamily="Anton, var(--font-poster), sans-serif">
                {score}%
              </text>
            </svg>
            <div className="min-w-0 flex-1">
              <p className="p-stamp text-bone/60">{r.score}</p>
              {steps.length === 0 ? (
                <p className="mt-1 text-[0.95rem]">{r.allDone}</p>
              ) : (
                <ol className="mt-1 grid gap-2">
                  {steps.slice(0, 3).map(([label, href], i) => (
                    <li key={label}>
                      <Link href={href} className="flex items-start gap-2 text-[0.95rem] leading-snug">
                        <span className="p-display text-[1rem] leading-none text-accent">{i + 1}</span>
                        <span className="flex-1 underline decoration-bone/30 underline-offset-4">{label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* 05 · La obra: a contact sheet on film. */}
        <section className="v2-block min-w-0">
          <Head n={5} title={r.work} sub={r.workSub} />
          <div className="v2-film mt-4">
            {pieces.slice(0, 8).map((x, i) => (
              <Link key={x.id} href="/studio/obras" className="relative block h-[130px] w-[104px] shrink-0 snap-start overflow-hidden rounded-[4px] bg-ink-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.url!} alt={x.title ?? ""} loading="lazy" className="h-full w-full object-cover" />
                <span className="p-stamp absolute bottom-1 left-1.5 text-[0.55rem] text-bone/80">{String(8 - i).padStart(2, "0")}A</span>
                {i === 0 && (
                  <svg viewBox="0 0 110 70" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
                    <path d="M8 40C6 18 30 4 58 8s46 24 40 46-40 30-64 22S4 52 12 30" fill="none" stroke="#efe7d6" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
              </Link>
            ))}
            <Link href="/studio/obras" className="grid h-[130px] w-[104px] shrink-0 snap-start place-items-center rounded-[4px] border border-dashed border-bone/30 text-center text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-bone/80">
              + {r.upload}
            </Link>
          </div>
          {perStyle.length > 0 && (
            <p className="p-stamp mt-2 px-1 text-bone/55">
              {perStyle.slice(0, 4).map(([st, n]) => fill(r.perStyle, { n, style: styleLabel(st, locale) })).join(" · ")}
            </p>
          )}
        </section>

        {/* 06 · La ruta: like the back of a tour shirt. */}
        {routeRows.length > 0 && (
          <section className="v2-block min-w-0">
            <Head n={6} title={r.route} sub={r.routeSub} />
            <ul className="mt-4 grid divide-y divide-bone/10 border-y border-bone/10">
              {routeRows.map((x) => (
                <li key={x.id}>
                  <Link href="/studio/pagina/fechas" className="flex min-h-16 items-center gap-3 py-3">
                    <span className="p-stamp w-[4.6rem] shrink-0 text-[0.55rem] leading-tight text-bone/60">{x.is_home ? r.home : [x.starts_on, x.ends_on].filter(Boolean).map((d) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))).join(" – ")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="p-display block truncate text-[1.6rem] uppercase leading-none">{x.city}</span>
                      {x.studio_name && <span className="block truncate text-[0.8rem] text-bone-dim">{x.studio_name}</span>}
                    </span>
                    <span className="shrink-0 text-right leading-tight">
                      <span className="p-display block text-[1.3rem] leading-none">{x.sessions}</span>
                      <span className="p-stamp block text-[0.55rem] text-bone/60">{x.sessions === 1 ? r.session1 : r.sessionsN}</span>
                      {x.free !== null && <span className="p-stamp block text-[0.55rem] text-bone/40">{fill(r.freeN, { n: x.free })}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 07 · El mes: the funnel. */}
        <section className="v2-block min-w-0">
          <Head n={7} title={r.month2} sub={r.monthSub} />
          <div className="mt-4 grid gap-2">
            {funnel.map(([label, v], i) => (
              <div key={label} className="flex items-center gap-3">
                <div className="h-11 rounded-[10px]" style={{ width: `${Math.max(14, (Math.sqrt(v) / fmax) * 72)}%`, background: i === 2 ? "var(--accent)" : `rgb(239 231 216 / ${0.18 - i * 0.05})` }} />
                <span className="min-w-0">
                  <span className="p-display block text-[1.6rem] leading-none tabular-nums">{v}</span>
                  <span className="p-stamp block text-bone/55">{label}</span>
                </span>
              </div>
            ))}
            <p className="p-stamp mt-1 text-bone/55">
              {s.conversion}: {conversion === null ? s.none : `${conversion}%`} · {s.followers}: {stats?.followers ?? 0} · {s.response}: {response}
            </p>
          </div>
        </section>

        {/* 08 · Caja. */}
        <section className="v2-block min-w-0">
          <Head n={8} title={r.caja} sub={r.cajaLead} />
          <div className="mt-2">
            <Caja
              artist={{ display_name: artist.display_name }}
              month={{ label: monthLabel, income: stats?.income ?? 0, deposits: stats?.deposits ?? 0, sessions: stats?.sessions ?? 0, expenses: stats?.expenses ?? 0 }}
              bars={bars}
              moves={moves}
              currency={artist.currency}
              t={t}
              locale={locale}
            />
          </div>
        </section>

        {/* 09 · Cuarto de máquinas: the pegboard. */}
        <section className="v2-block min-w-0">
          <Head n={9} title={r.machines} sub={r.machinesSub} />
          <ul className="v2-pegboard mt-4 grid grid-cols-3 gap-2 rounded-[22px] p-2">
            {tiles.map(([label, href, icon, ok]) => (
              <li key={label}>
                <Link href={href} className="relative grid h-24 content-between rounded-[16px] border border-bone/12 bg-ink-2/90 p-3">
                  <svg viewBox="0 0 20 20" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {icon}
                  </svg>
                  <span className="text-[0.82rem] font-semibold">{label}</span>
                  <span aria-hidden className={`absolute right-3 top-3 h-2 w-2 rounded-full ${ok ? "bg-[var(--color-olive,#6f8f5c)]" : "bg-accent"}`} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} badge={stats?.pending} />
    </div>
  );
}

/** A block's head: the number on its rule, the title, a line under it. */
function Head({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="px-1">
      <span className="flex items-center gap-2 text-[0.62rem] font-medium tracking-[0.12em] text-bone/85">
        {String(n).padStart(2, "0")}
        <span className="h-px w-8 bg-bone/70" />
      </span>
      <h2 className="p-display mt-1 text-[2.1rem] uppercase leading-[0.88]">{title}</h2>
      {sub && <p className="mt-1 text-[0.85rem] leading-snug text-bone/60 first-letter:uppercase">{sub}</p>}
    </div>
  );
}

function relativeAgo(d: Date | string, locale: string, now: number) {
  const mins = Math.max(1, Math.round((now - new Date(d).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return mins < 60 ? rtf.format(-mins, "minute") : mins < 48 * 60 ? rtf.format(-Math.round(mins / 60), "hour") : rtf.format(-Math.round(mins / 1440), "day");
}
