"use client";

import type { Locale } from "@/i18n";

const tag = (locale: Locale) => (locale === "es" ? "es-US" : "en-US");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

export interface CalendarLabels {
  open: string;
  taken: string;
}

/**
 * A stop's days, month by month: the days inside the stop are open or taken,
 * the days around them fade out. Days, not hours; the artist says which days
 * are gone, the brief and quote settle the time.
 */
export function StopCalendar({
  start,
  end,
  taken,
  allTaken = false,
  locale,
  labels,
  today,
}: {
  start: string;
  end: string;
  taken: Set<string>;
  /** The artist marked the stop full: every day reads as taken. */
  allTaken?: boolean;
  locale: Locale;
  labels: CalendarLabels;
  today: string;
}) {
  const months: { y: number; m: number }[] = [];
  for (let d = utc(start), i = 0; i < 3 && iso(d) <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), i++) {
    months.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }
  const monthName = new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(tag(locale), { weekday: "narrow", timeZone: "UTC" });
  // Monday first; the 5th of January 1970 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(Date.UTC(1970, 0, 5 + i))));

  return (
    <div className={`grid gap-5 ${months.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {months.map(({ y, m }) => {
        const first = new Date(Date.UTC(y, m, 1));
        const lead = (first.getUTCDay() + 6) % 7;
        const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        return (
          <table key={`${y}-${m}`} className="w-full border-separate border-spacing-y-1 text-center">
            <caption className="p-stamp mb-2 text-left text-bone-dim">{monthName.format(first)}</caption>
            <thead>
              <tr>
                {weekdays.map((w, i) => (
                  <th key={i} scope="col" className="p-stamp py-1 text-[0.58rem] font-semibold text-bone/50">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil((lead + n) / 7) }, (_, w) => (
                <tr key={w}>
                  {Array.from({ length: 7 }, (_, c) => {
                    const day = w * 7 + c - lead + 1;
                    if (day < 1 || day > n) return <td key={c} />;
                    const d = iso(new Date(Date.UTC(y, m, day)));
                    const inside = d >= start && d <= end;
                    const gone = inside && (allTaken || taken.has(d) || d < today);
                    const open = inside && !gone;
                    const state = open ? labels.open : gone ? labels.taken : undefined;
                    return (
                      <td key={c} className="p-0">
                        <span
                          aria-label={state ? `${day}, ${state}` : undefined}
                          className={`t-num mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[0.9rem] ${
                            open
                              ? "border border-accent bg-accent/15 font-semibold text-bone"
                              : gone
                                ? "text-bone/35 line-through decoration-oxblood/80 decoration-[1.5px]"
                                : "text-bone/25"
                          } ${d === today ? "underline decoration-bone/50 underline-offset-4" : ""}`}
                        >
                          {day}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

/** How many days of a stop are still open: inside the dates, not taken, not already gone by. */
export function openDays(start: string, end: string, taken: Set<string>, today: string) {
  let n = 0;
  for (let d = utc(start); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = iso(d);
    if (s >= today && !taken.has(s)) n++;
  }
  return n;
}
