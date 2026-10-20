"use client";

import { useState } from "react";

import type { Locale } from "@/i18n";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const tag = (locale: Locale) => (locale === "es" ? "es-US" : "en-US");

/** A thin hand-drawn flourish, for the corners and the foot of the paper. */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 12c18 0 22-9 34-9s14 9 24 9 12-9 24-9 16 9 34 9" />
      <path
        d="M2 12c18 0 22 9 34 9s14-9 24-9 12 9 24 9 16-9 34-9"
        opacity=".5"
      />
      <circle cx="60" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * An artist's month as a printed wall calendar: an illustration across the
 * top, the month in serif, the days. Free days can be tapped; past days, days
 * outside the city's dates and taken days are printed faint. Used on the
 * artist's agenda and in the request, where the client picks their day.
 */
export function PaperCalendar({
  locale,
  labels,
  taken,
  onPick,
  from,
  to,
  city,
  art,
  quote,
  selected = null,
  marks,
  closed: shutDays,
  pickAny = false,
  monthStart,
}: {
  locale: Locale;
  labels: { prevMonth: string; nextMonth: string };
  taken: Set<string>;
  onPick: (day: string) => void;
  /** The first and last day of this city's calendar; home has no end. */
  from: string;
  to: string | null;
  city: string;
  /** The plate across the top: the artist's calendar art, else one of their pieces (picked per month by the caller). */
  art: string | null;
  /** The artist's line at the foot of the sheet. */
  quote: string | null;
  /** A day already chosen (the request's calendar keeps it marked). */
  selected?: string | null;
  /** The artist's own agenda: how many sessions each day holds, the days they closed, and every day open to a tap. */
  marks?: Record<string, number>;
  closed?: Set<string>;
  pickAny?: boolean;
  /** Start the sheet at this month even if it lies before today (the artist's agenda shows the whole current month). */
  monthStart?: string;
}) {
  const p = labels;
  const today = isoDay(new Date());
  // The months this city's calendar covers: from its first open day to its last (home has no end).
  const start = monthStart ?? (from > today ? from : today);
  const base = new Date(`${start}T00:00:00Z`);
  const lastOffset = to
    ? Math.max(
        0,
        (Number(to.slice(0, 4)) - base.getUTCFullYear()) * 12 +
          Number(to.slice(5, 7)) -
          1 -
          base.getUTCMonth(),
      )
    : 11;
  const [offset, setOffset] = useState(0);
  const first = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1),
  );
  const lead = (first.getUTCDay() + 6) % 7;
  const n = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const weekday = new Intl.DateTimeFormat(tag(locale), {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(Date.UTC(1970, 0, 5 + i))),
  );
  const month = new Intl.DateTimeFormat(tag(locale), {
    month: "long",
    timeZone: "UTC",
  }).format(first);
  const sunday = (i: number) => i === 6;

  return (
    <div className="relative overflow-hidden rounded-[18px] bg-[#fbf8f2] text-[#1c1815] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.85)]">
      {/* The month's illustration, full bleed across the top, like a wall calendar's plate. */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#1c1815]">
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={art}
            src={art}
            alt=""
            className="animate-glow absolute inset-0 h-full w-full object-cover"
            style={{ animationDuration: "500ms", opacity: 1 }}
          />
        )}
        {!art && (
          // No art yet: a printed plate of circles and flourishes in the artist's colour.
          <svg
            viewBox="0 0 320 200"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <rect width="320" height="200" fill="#1c1815" />
            {[30, 55, 80, 105, 130].map((r) => (
              <circle
                key={r}
                cx="250"
                cy="40"
                r={r}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity={0.5 - r / 400}
              />
            ))}
            <path
              d="M0 150 C 60 120, 110 180, 170 150 S 280 120, 320 150"
              fill="none"
              stroke="#efe7d6"
              strokeOpacity=".25"
            />
            <path
              d="M0 165 C 60 135, 110 195, 170 165 S 280 135, 320 165"
              fill="none"
              stroke="#efe7d6"
              strokeOpacity=".15"
            />
          </svg>
        )}
        <span className="p-stamp absolute right-3 top-3 rounded-full bg-[#fbf8f2]/85 px-2.5 py-1 text-[0.55rem] text-[#1c1815]">
          {city}
        </span>
      </div>
      <div className="relative px-4 pt-4 pb-3">
        <div className="flex items-end justify-between gap-3">
          <p className="font-serif text-[clamp(2.4rem,11vw,3.2rem)] leading-none font-light tracking-[0.04em] uppercase">
            {month}
          </p>
          <p className="font-serif text-[1rem] text-[#554c42] italic">
            {first.getUTCFullYear()}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
          {weekdays.map((w, i) => (
            <span
              key={i}
              className={`pb-1 text-[0.72rem] font-semibold ${sunday(i) ? "text-[var(--accent)]" : "text-[#554c42]"}`}
            >
              {w}
            </span>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`l${i}`} />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const day = isoDay(
              new Date(
                Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i + 1),
              ),
            );
            const outside = day < from || (to !== null && day > to);
            const gone = day < today || outside || taken.has(day);
            const isToday = day === today;
            const picked = day === selected;
            const count = marks?.[day] ?? 0;
            const shut = shutDays?.has(day) ?? false;
            if (gone && !(pickAny && !outside))
              return (
                <span key={day} className="t-num mx-auto flex h-11 w-11 items-center justify-center text-[1.15rem] text-[#1c1815]/25">
                  {i + 1}
                </span>
              );
            return (
              <button
                key={day}
                type="button"
                onClick={() => onPick(day)}
                aria-pressed={picked}
                aria-label={count || shut ? `${day}: ${count ? count : "closed"}` : undefined}
                className={`t-num relative mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[1.2rem] font-medium transition-colors ${
                  picked
                    ? "bg-[#1c1815] text-[#fbf8f2] ring-2 ring-[var(--accent)]"
                    : isToday
                      ? "bg-[var(--accent)] text-white"
                      : shut
                        ? "text-[#1c1815]/35 line-through decoration-[var(--accent)]"
                        : day < today
                          ? "text-[#1c1815]/45"
                          : "hover:bg-[#1c1815] hover:text-[#fbf8f2]"
                }`}
              >
                {i + 1}
                {count > 0 && (
                  <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden>
                    {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                      <span key={k} className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-white" : "bg-[var(--accent)]"}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#1c1815]/10 pt-3">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.3rem] disabled:opacity-20"
            aria-label={p.prevMonth}
          >
            ‹
          </button>
          {quote ? (
            <p className="line-clamp-2 flex-1 text-center font-serif text-[0.9rem] text-[#554c42] italic">
              {quote}
            </p>
          ) : (
            <Flourish className="h-5 w-28 text-[#1c1815]/40" />
          )}
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(lastOffset, o + 1))}
            disabled={offset >= lastOffset}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.3rem]"
            aria-label={p.nextMonth}
            data-next
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

