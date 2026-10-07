import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { money, requestTime, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import { listAppointments, type AppointmentItem } from "@/lib/queries";

import { calendarFeedUrl } from "../actions";
import { CopyButton } from "../CopyButton";
import { BookingActions } from "./BookingActions";

const TONE: Record<AppointmentItem["status"], string> = {
  confirmed: "text-verdigris",
  completed: "text-ash",
  no_show: "text-oxblood",
  cancelled: "text-ash-dim",
};

export default async function BookingsPage() {
  const member = await requireMember();
  const [{ t, locale }, items, feed] = await Promise.all([getDict(), listAppointments(member.studioId), calendarFeedUrl()]);
  const b = t.studio.bookings;
  const now = requestTime();
  const upcoming = items.filter((a) => new Date(a.ends_at).getTime() >= now && a.status !== "cancelled");
  const past = items.filter((a) => !upcoming.includes(a)).reverse();

  const list = (rows: AppointmentItem[], isPast: boolean) => (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-niche">
      {rows.length === 0 ? (
        <p className="p-5 text-ash">{b.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => {
            const { day, time } = sessionTime(a.starts_at, a.timezone, locale);
            return (
              <li key={a.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5">
                <div>
                  <p className="font-serif text-[1.25rem] leading-tight">{day}</p>
                  <p className="t-num text-[0.9rem] text-ash">
                    {time}
                    {a.city ? `, ${a.city}` : ""}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.brief_id ? (
                      <Link href={`/studio?tab=booked&brief=${a.brief_id}`} className="hover:text-gilt-bright">
                        {a.client_name}
                      </Link>
                    ) : (
                      a.client_name
                    )}
                  </p>
                  <p className="truncate text-[0.9rem] text-ash">
                    {a.placement ? placementLabel(a.placement, locale) : ""}
                    {a.deposit_cents ? `, ${fill(b.deposit, { amount: money(a.deposit_cents, a.currency ?? "usd", locale) })}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className={`pill ${TONE[a.status]}`}>{b.status[a.status]}</span>
                  {a.status === "confirmed" && <BookingActions id={a.id} past={isPast || new Date(a.starts_at).getTime() < now} labels={{ done: b.markDone, noShow: b.markNoShow, cancel: b.cancel }} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{b.title}</h1>
      <p className="mt-1 text-ash">{b.lead}</p>
      <section aria-labelledby="up" className="mt-8">
        <h2 id="up" className="t-heading mb-3">
          {b.upcoming}
        </h2>
        {list(upcoming, false)}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past" className="mt-10">
          <h2 id="past" className="t-heading mb-3">
            {b.past}
          </h2>
          {list(past, true)}
        </section>
      )}
      <section aria-labelledby="feed" className="mt-10 grid gap-3 border-t border-line pt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <h2 id="feed" className="font-semibold">
            {b.calendarFeed}
          </h2>
          <p className="mt-1 max-w-[56ch] text-[0.92rem] text-ash">{b.calendarFeedHint}</p>
        </div>
        <CopyButton text={feed} label={t.common.copy} done={t.common.copied} />
      </section>
    </main>
  );
}
