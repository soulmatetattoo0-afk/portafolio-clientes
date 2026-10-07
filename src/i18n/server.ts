import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, dict, pickLocale, type Locale } from ".";

export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, t: dict(locale) };
}
