import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { listMyAppointments, requireClient, type MyAppointment } from "@/lib/client";
import { placeLine, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import type { Locale } from "@/i18n";

import { AccentDot, Empty, PageHead, SectionHead } from "../ui";

export const metadata = { robots: { index: false } };

export default async function MyAppointmentsPage() {
  const me = await requireClient("/me/appointments");
  const [{ t, locale }, { upcoming, past }] = await Promise.all([getDict(), listMyAppointments(me.userId)]);
  const a = t.me.appointments;
  const labels = { with: a.with, calendar: a.addToCalendar, booking: a.openBooking, status: a.status };
  return (
    <>
      <PageHead title={a.title} lead={a.lead} />
      {!upcoming.length && !past.length ? (
        <Empty text={a.empty} cta={{ href: "/me/briefs", label: t.me.nav.briefs }} />
      ) : (
        <div className="grid gap-10">
          <section aria-labelledby="upcoming">
            <SectionHead id="upcoming">{a.upcoming}</SectionHead>
            {upcoming.length ? <List items={upcoming} locale={locale} labels={labels} lead /> : <p className="text-bone-dim">{a.empty}</p>}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past">
              <SectionHead id="past">{a.past}</SectionHead>
              <List items={past} locale={locale} labels={labels} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function List({ items, locale, labels, lead = false }: { items: MyAppointment[]; locale: Locale; labels: { with: string; calendar: string; booking: string; status: Record<MyAppointment["status"], string> }; lead?: boolean }) {
  return (
    <ul className="grid gap-3">
      {items.map((ap, i) => {
        const { day, time } = sessionTime(ap.starts_at, ap.timezone, locale);
        const where = placeLine(ap.studio_name, ap.address, ap.city);
        const first = lead && i === 0;
        return (
          <li key={ap.id} className={`rounded-[16px] border p-4 ${first ? "border-line-strong bg-ink-2" : "border-line"}`} style={first ? { ["--accent" as string]: ap.artist_accent ?? undefined } : undefined}>
            <p className={first ? "p-display text-[2.2rem] text-accent" : "text-[1.1rem] text-bone"}>{day}</p>
            <p className="mt-1 text-bone">
              {time}
              {ap.placement ? `, ${placementLabel(ap.placement, locale).toLowerCase()}` : ""}
            </p>
            <p className="mt-2 flex items-center gap-2 text-bone-dim">
              <AccentDot accent={ap.artist_accent} />
              <Link href={`/${ap.artist_slug}`} className="underline-offset-4 hover:underline">
                {fill(labels.with, { artist: ap.artist_name })}
              </Link>
            </p>
            {where && <p className="text-[0.92rem] text-bone-dim">{where}</p>}
            {ap.status !== "confirmed" && <p className="p-stamp mt-2 text-bone-dim">{labels.status[ap.status]}</p>}
            {ap.quote_token && ap.status === "confirmed" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/q/${ap.quote_token}/ics`} className={first ? "btn btn-accent" : "btn btn-secondary"}>
                  {labels.calendar}
                </a>
                <Link href={`/q/${ap.quote_token}`} className="btn btn-secondary">
                  {labels.booking}
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
