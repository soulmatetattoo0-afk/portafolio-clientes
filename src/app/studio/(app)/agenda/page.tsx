import Link from "next/link";

import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";

import { AgendaMonth } from "./AgendaMonth";

const MONTH = /^\d{4}-\d{2}$/;

/** The artist's agenda: a month of booked sessions and closed days. */
export default async function AgendaPage({ searchParams }: PageProps<"/studio/agenda">) {
  const member = await requireMember();
  const sp = await searchParams;
  const { t, locale } = await getDict();
  const a = t.agenda;
  const db = await getDb();
  const tz = (await db.one<{ timezone: string }>(`select timezone from tour_stops where artist_id = $1 order by is_home desc limit 1`, [member.artistId]))?.timezone ?? "America/New_York";
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = typeof sp.m === "string" && MONTH.test(sp.m) ? sp.m : now.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);

  const [sessions, off] = await Promise.all([
    db.query<{ id: string; day: string; time: string; client: string; brief_id: string | null; city: string | null; hours: number }>(
      `select ap.id, to_char(ap.starts_at at time zone ap.timezone, 'YYYY-MM-DD') as day, to_char(ap.starts_at at time zone ap.timezone, 'HH24:MI') as time,
              c.name as client, ap.brief_id, ap.city, extract(epoch from ap.ends_at - ap.starts_at)::float / 3600 as hours
         from appointments ap join clients c on c.id = ap.client_id
        where ap.artist_id = $1 and ap.status = 'confirmed'
          and (ap.starts_at at time zone ap.timezone)::date >= $2::date and (ap.starts_at at time zone ap.timezone)::date < ($2::date + interval '1 month')
        order by ap.starts_at`,
      [member.artistId, first],
    ),
    db.query<{ day: string }>(`select to_char(day, 'YYYY-MM-DD') as day from days_off where artist_id = $1 and day >= $2::date and day < ($2::date + interval '1 month')`, [member.artistId, first]),
  ]);
  const raw = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{a.title}</h1>
      <p className="mt-1 mb-6 max-w-[64ch] text-ash">{a.lead}</p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={`/studio/agenda?m=${prev}`} className="btn btn-ghost btn-sm" aria-label={a.prev}>
          ←
        </Link>
        <p className="font-serif text-[1.6rem]">{title}</p>
        <Link href={`/studio/agenda?m=${next}`} className="btn btn-ghost btn-sm" aria-label={a.next}>
          →
        </Link>
      </div>
      <AgendaMonth month={month} today={now} sessions={sessions} off={off.map((o) => o.day)} t={a} locale={locale} />
      <p className="mt-3 text-[0.85rem] text-ash">{a.hint}</p>
      <section className="mt-10" aria-labelledby="sessions-h">
        <h2 id="sessions-h" className="t-label mb-3">
          {a.sessions}
        </h2>
        {sessions.length === 0 ? (
          <p className="text-ash">{a.none}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={s.brief_id ? `/studio?tab=booked&brief=${s.brief_id}` : "/studio/bookings"} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-niche-2">
                  <span className="min-w-0">
                    <span className="block truncate">{s.client}</span>
                    <span className="block text-[0.85rem] text-ash">{[s.city, `${Math.round(s.hours * 10) / 10} h`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="t-num shrink-0 text-right text-[0.9rem]">
                    {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s.day}T00:00:00Z`))}
                    <span className="block text-ash">{s.time}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
