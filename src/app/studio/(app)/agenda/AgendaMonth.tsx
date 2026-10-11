"use client";

import { useOptimistic, useTransition } from "react";

import type { Dict, Locale } from "@/i18n";

import { toggleDayOff } from "../actions";

/** The month grid: each day shows its sessions; a tap closes the day or opens it again. */
export function AgendaMonth({
  month,
  today,
  sessions,
  off,
  t,
  locale,
}: {
  month: string;
  today: string;
  sessions: { id: string; day: string; time: string; client: string }[];
  off: string[];
  t: Dict["agenda"];
  locale: Locale;
}) {
  const [, start] = useTransition();
  const [closed, flip] = useOptimistic(new Set(off), (set: Set<string>, day: string) => {
    const next = new Set(set);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    return next;
  });
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Weeks start on Monday.
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const names = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);

  return (
    <div>
      <ol className="grid grid-cols-7 gap-1 text-center text-[0.72rem] text-ash uppercase" aria-hidden>
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ol>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`x${i}`} aria-hidden />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const list = byDay.get(day) ?? [];
          const isOff = closed.has(day);
          const past = day < today;
          return (
            <li key={day}>
              <button
                type="button"
                disabled={past}
                onClick={() => start(async () => {
                  flip(day);
                  await toggleDayOff(day);
                })}
                aria-label={`${day}: ${list.length ? t.booked : isOff ? t.off : t.open}. ${isOff ? t.reopen : t.close}`}
                className={`flex aspect-square w-full flex-col items-start rounded-[8px] border p-1.5 text-left transition-colors sm:aspect-[4/3] ${
                  isOff ? "border-oxblood/50 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.04)_6px_8px)] text-ash" : list.length ? "border-gilt/60 bg-gilt/10" : "border-line hover:border-line-strong"
                } ${day === today ? "ring-1 ring-vellum" : ""} ${past ? "opacity-40" : ""}`}
              >
                <span className="t-num text-[0.85rem]">{i + 1}</span>
                {list.slice(0, 2).map((s) => (
                  <span key={s.id} className="mt-0.5 hidden w-full truncate text-[0.68rem] text-gilt sm:block">
                    {s.time} {s.client.split(" ")[0]}
                  </span>
                ))}
                {list.length > 0 && <span className="mt-auto h-1.5 w-1.5 rounded-full bg-gilt sm:hidden" aria-hidden />}
                {isOff && <span className="mt-auto text-[0.62rem] uppercase">{t.off}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
