"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { fill, type Dict, type Locale } from "@/i18n";

import { pickOfferDay } from "@/app/c/[token]/actions";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isoDay = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
const tag = (locale: Locale) => (locale === "es" ? "es-US" : "en-US");

/**
 * The artist's calendar inside the chat: the next months with the open days
 * to tap. A tap picks the day, a second tap on the button books it: the slot
 * is made on the server and the client goes on to the deposit.
 */
export function PickDays({
  chatToken,
  token,
  pick,
  locale,
  t,
}: {
  chatToken: string;
  token: string;
  pick: { time: string; hours: number; until: string; taken: string[]; closedWeekdays: number[]; today: string };
  locale: Locale;
  t: Dict["chat"]["offer"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const taken = new Set(pick.taken);
  const closed = new Set(pick.closedWeekdays);
  const first = new Date(`${pick.today}T00:00:00Z`);
  const [view, setView] = useState({ y: first.getUTCFullYear(), m: first.getUTCMonth() });
  const monthName = new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(tag(locale), { weekday: "narrow", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(Date.UTC(1970, 0, 5 + i))));
  const long = (day: string) => new Intl.DateTimeFormat(tag(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

  const monthStart = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (monthStart.getUTCDay() + 6) % 7;
  const n = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const canPrev = iso(monthStart) > pick.today.slice(0, 7) + "-01";
  const canNext = iso(new Date(Date.UTC(view.y, view.m + 1, 1))) <= pick.until;
  const isOpen = (day: string) => day > pick.today && day <= pick.until && !taken.has(day) && !closed.has(isoDay(day));

  const book = () => {
    if (!chosen) return;
    setError(null);
    start(async () => {
      const res = await pickOfferDay(chatToken, token, chosen);
      if ("error" in res) {
        setError(res.error);
        setChosen(null);
        router.refresh();
      } else router.push(res.url);
    });
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))} disabled={!canPrev} aria-label={t.prevMonth}>
          ←
        </button>
        <p className="font-serif text-[1.1rem] capitalize">{monthName.format(monthStart)}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))} disabled={!canNext} aria-label={t.nextMonth}>
          →
        </button>
      </div>
      <ol className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.68rem] text-ash uppercase" aria-hidden>
        {weekdays.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ol>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`x${i}`} aria-hidden />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const day = iso(new Date(Date.UTC(view.y, view.m, i + 1)));
          const open = isOpen(day);
          const picked = chosen === day;
          return (
            <li key={day}>
              <button
                type="button"
                disabled={!open}
                onClick={() => setChosen(picked ? null : day)}
                aria-pressed={picked}
                aria-label={`${long(day)}: ${open ? t.open : t.gone}`}
                className={`t-num flex aspect-square w-full items-center justify-center rounded-full text-[0.9rem] transition-colors ${
                  picked ? "bg-gilt font-semibold text-soot" : open ? "border border-line text-vellum hover:border-gilt" : "text-ash-dim line-through decoration-ash-dim/60"
                }`}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-3 text-[0.85rem] text-oxblood">
          {error}
        </p>
      )}
      {chosen ? (
        <div className="mt-3 grid gap-2">
          <button type="button" className="btn btn-primary w-full" onClick={book} disabled={pending} aria-busy={pending}>
            {fill(t.pickConfirm, { date: long(chosen) })}
          </button>
          <button type="button" className="btn btn-ghost btn-sm justify-self-center" onClick={() => setChosen(null)}>
            {t.pickChange}
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-3 text-[0.75rem] text-ash">
          <span className="inline-block h-3 w-3 rounded-full border border-line" /> {t.open}
          <span className="ml-2 inline-block text-ash-dim line-through">00</span> {t.gone}
        </p>
      )}
    </div>
  );
}
