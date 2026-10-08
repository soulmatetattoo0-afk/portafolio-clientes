import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { followedSpots, listFollowed, listMyAppointments, listOpenQuotes, requireClient } from "@/lib/client";
import { dateLong, dateRange, money, placeLine, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";

import { AccentDot, Empty, SectionHead } from "./ui";

export const metadata = { robots: { index: false } };

export default async function OverviewPage() {
  const me = await requireClient("/me");
  const [{ t, locale }, { upcoming }, quotes, spots, followed] = await Promise.all([getDict(), listMyAppointments(me.userId), listOpenQuotes(me.userId), followedSpots(me.userId), listFollowed(me.userId)]);
  const o = t.me.overview;
  const next = upcoming[0] ?? null;
  const first = me.name?.split(" ")[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <h1 className="p-display text-[clamp(2.8rem,13vw,4.4rem)] text-bone">{first ? fill(o.title, { name: first }) : o.titleAnon}</h1>

      {/* The lead object: the next session, in that artist's own colour. */}
      <section aria-labelledby="next">
        <SectionHead id="next">{o.next}</SectionHead>
        {next ? (
          (() => {
            const { day, time } = sessionTime(next.starts_at, next.timezone, locale);
            const where = placeLine(next.studio_name, next.address, next.city);
            return (
              <article className="relative overflow-hidden rounded-[18px] border border-line-strong bg-ink-2 p-5" style={{ ["--accent" as string]: next.artist_accent ?? undefined }}>
                <div className="p-halftone" aria-hidden />
                <div className="relative">
                  <p className="p-display text-[clamp(2.4rem,11vw,3.6rem)] text-accent">{day}</p>
                  <p className="mt-1 text-[1.1rem] text-bone">
                    {time}
                    {next.placement ? `, ${placementLabel(next.placement, locale).toLowerCase()}` : ""}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-bone">
                    <AccentDot accent={next.artist_accent} />
                    {fill(t.me.appointments.with, { artist: next.artist_name })}
                  </p>
                  {where && <p className="mt-1 text-bone-dim">{where}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {next.quote_token && (
                      <>
                        <a href={`/q/${next.quote_token}/ics`} className="btn btn-accent">
                          {o.addToCalendar}
                        </a>
                        <Link href={`/q/${next.quote_token}`} className="btn btn-secondary">
                          {o.openBooking}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })()
        ) : (
          <p className="text-bone-dim">{o.noNext}</p>
        )}
      </section>

      {quotes.length > 0 && (
        <section aria-labelledby="quotes">
          <SectionHead id="quotes">{o.quotes}</SectionHead>
          <ul className="grid gap-3">
            {quotes.map((q) => (
              <li key={q.token} className="rounded-[14px] border border-line-strong p-4">
                <p className="p-quote text-[1.35rem] leading-tight text-bone">{fill(o.quoteLine, { artist: q.artist_name, placement: placementLabel(q.placement, locale).toLowerCase() })}</p>
                <p className="mt-2 text-[0.92rem] text-bone-dim">
                  {fill(o.deposit, { amount: money(q.deposit_cents, q.currency, locale) })}. {fill(o.validUntil, { date: dateLong(q.expires_at, locale) })}. {q.ref}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/q/${q.token}`} className="btn btn-primary">
                    {o.pay}
                  </Link>
                  <Link href={`/me/briefs/${q.brief_id}`} className="btn btn-secondary">
                    {o.seeBrief}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="spots">
        <SectionHead id="spots">{o.spots}</SectionHead>
        {spots.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {spots.map((s) => (
              <li key={s.id}>
                <Link href={`/${s.artist_slug}#spots`} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[1.05rem] text-bone">{s.city}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[0.9rem] text-bone-dim">
                      <AccentDot accent={s.artist_accent} />
                      <span className="truncate">{s.artist_name}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[0.9rem] text-bone-dim">
                    {dateRange(s.starts_on, s.ends_on, locale)}
                    {s.status === "booking" && <span className="p-stamp mt-0.5 block text-accent">{t.me.saved.booking}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-bone-dim">{o.noSpots}</p>
        )}
      </section>

      <section aria-labelledby="following">
        <SectionHead
          id="following"
          aside={
            followed.length > 0 && (
              <Link href="/me/saved" className="p-stamp py-1 text-accent">
                {o.seeAll}
              </Link>
            )
          }
        >
          {o.following}
        </SectionHead>
        {followed.length ? (
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {followed.map((a) => (
              <li key={a.id} className="w-[9.5rem] shrink-0">
                <Link href={`/${a.slug}`} className="block rounded-[14px] border border-line-strong bg-ink-2 p-3.5 transition-colors hover:border-bone-dim">
                  <AccentDot accent={a.accent} />
                  <span className="p-display mt-3 block text-[1.35rem] leading-[0.95] text-bone">{a.display_name}</span>
                  <span className="mt-1 block truncate text-[0.85rem] text-bone-dim">{a.home_city ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={o.noFollowing} cta={{ href: "/explore", label: o.findArtists }} />
        )}
      </section>

      <section aria-labelledby="issue">
        <SectionHead id="issue">{o.issue}</SectionHead>
        <p className="p-quote text-[1.25rem] text-bone-dim">{o.issueSoon}</p>
      </section>
    </div>
  );
}
