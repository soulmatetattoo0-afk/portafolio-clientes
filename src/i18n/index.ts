import en, { type Dict } from "./en";
import es from "./es";

export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];
export const LOCALE_COOKIE = "lang";

const dictionaries: Record<Locale, Dict> = { en, es };

export function dict(locale: Locale): Dict {
  return dictionaries[locale];
}

/** Replace {name} placeholders. Unknown keys are left visible so gaps are easy to spot. */
export function fill(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function pickLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (cookie === "en" || cookie === "es") return cookie;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : "en";
}

export type { Dict };
