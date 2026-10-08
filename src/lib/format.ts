import type { Locale } from "@/i18n";

const tag = (locale: Locale) => (locale === "es" ? "es-US" : "en-US");

export function money(cents: number | null | undefined, currency = "usd", locale: Locale = "en") {
  if (cents == null) return "";
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function moneyRange(min: number | null, max: number | null, currency = "usd", locale: Locale = "en") {
  if (min == null && max == null) return "";
  if (max == null || max === min) return money(min ?? max, currency, locale);
  return `${money(min, currency, locale)}–${money(max, currency, locale)}`;
}

/** "Sat, Nov 14 · 1:00 PM" in the time zone of the city where the session happens. */
export function sessionTime(date: Date | string, timezone: string, locale: Locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = new Intl.DateTimeFormat(tag(locale), { weekday: "short", month: "short", day: "numeric", timeZone: timezone }).format(d);
  const time = new Intl.DateTimeFormat(tag(locale), { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(d);
  return { day, time };
}

export function dateLong(date: Date | string, locale: Locale = "en", timezone?: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(tag(locale), { weekday: "long", month: "long", day: "numeric", timeZone: timezone }).format(d);
}

/** "October 2026", for an issue's date line. */
export function monthYear(date: Date | string, locale: Locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateRange(start: string | null, end: string | null, locale: Locale = "en") {
  if (!start) return "";
  const f = new Intl.DateTimeFormat(tag(locale), { month: "short", day: "numeric", timeZone: "UTC" });
  const a = f.format(new Date(`${start}T00:00:00Z`));
  if (!end || end === start) return a;
  return `${a} – ${f.format(new Date(`${end}T00:00:00Z`))}`;
}

export function relativeTime(date: Date | string, locale: Locale = "en") {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(tag(locale), { month: "short", day: "numeric" }).format(d);
}

export const cmLabel = (w: number | null, h: number | null) => (w && h ? `${Number(w)} × ${Number(h)} cm` : "");

/** Minutes a time zone is ahead of UTC at a given instant. */
function tzOffset(ts: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(ts);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts) / 60000;
}

/** "2026-11-14" + "13:00" on the wall clock of `timezone` → the UTC instant. */
export function zonedToUtc(date: string, time: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffset(guess, timezone) * 60000;
  const second = guess - tzOffset(utc, timezone) * 60000;
  if (second !== utc) utc = second;
  return new Date(utc);
}

/** UTC instant → { date: "YYYY-MM-DD", time: "HH:MM" } on the wall clock of `timezone`. */
export function utcToZoned(instant: Date | string, timezone: string) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** "Studio, street, city" without repeating the city when the address already has it. */
export function placeLine(studio: string | null | undefined, address: string | null | undefined, city: string | null | undefined) {
  const showCity = city && !(address ?? "").toLowerCase().includes(city.toLowerCase());
  return [studio, address, showCity ? city : null].filter(Boolean).join(", ");
}

/** Current time for server-rendered pages (each request renders once, so this is stable per render). */
export const requestTime = () => Date.now();
