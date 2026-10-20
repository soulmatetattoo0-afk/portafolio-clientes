"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { dict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getMember, getSession } from "@/lib/auth";
import { COUNTRIES, STYLE_BY_SLUG, TIMEZONES } from "@/lib/catalog";
import { LayoutSchema } from "@/lib/layout";
import { getDb } from "@/lib/db";
import { placeCity } from "@/lib/geo";
import { env } from "@/lib/env";
import { slugify } from "@/lib/util";

export interface OnboardingState {
  error: string | null;
  field?: "name" | "slug" | "city";
}

/** Paths the app owns; an artist page can't take them. */
const RESERVED = new Set(["studio", "login", "logout", "auth", "api", "q", "admin", "app", "help", "pricing", "about", "terms", "privacy", "brief", "www", "mail", "artists", "explore", "search", "city", "cities", "issue", "issues", "vanta", "me", "signin", "join", "tattoo", "barber", "barbers", "graffiti", "murals", "saved", "account"]);

const Input = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/),
  city: z.string().trim().min(2).max(80),
  country: z.enum(["cl", "us", "mx"]),
  timezone: z.string().refine((tz) => TIMEZONES.includes(tz)),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  styles: z.array(z.string().refine((s) => STYLE_BY_SLUG.has(s))).max(5),
  layout: LayoutSchema.nullable(),
});

const json = (v: FormDataEntryValue | null) => {
  try {
    return v ? JSON.parse(String(v)) : null;
  } catch {
    return null;
  }
};

export async function createStudio(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const locale = await getLocale();
  const t = dict(locale);
  const session = await getSession();
  if (!session) redirect("/login");
  if (await getMember(session)) redirect("/studio");
  if (env.allowedSignups.length && !env.allowedSignups.includes(session.email.toLowerCase())) return { error: t.studio.onboarding.notInvited };
  const parsed = Input.safeParse({
    name: form.get("name"),
    slug: slugify(String(form.get("slug") || form.get("name") || "")),
    city: form.get("city"),
    country: form.get("country"),
    timezone: form.get("timezone"),
    accent: form.get("accent") || null,
    styles: String(form.get("styles") ?? "").split(",").filter(Boolean),
    layout: json(form.get("layout")),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "slug" ? t.studio.onboarding.slugHint : t.common.error, field: field === "name" || field === "slug" || field === "city" ? field : undefined };
  }
  const p = parsed.data;
  // The country is stored by name, in English, the way search and the city pages read it.
  const country = COUNTRIES.find((c) => c.code === p.country)!.label.en;
  if (RESERVED.has(p.slug)) return { error: t.studio.onboarding.slugTaken, field: "slug" };
  const db = await getDb();
  try {
    await db.tx(async (tx) => {
      const studio = await tx.one<{ id: string }>(`insert into studios (slug, name) values ($1, $2) returning id`, [p.slug, p.name]);
      const place = placeCity(p.city, country);
      const artist = await tx.one<{ id: string }>(`insert into artists (studio_id, slug, display_name, home_city, country, city_slug, lat, lng, listed, accent, styles, layout) values ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, $11) returning id`, [
        studio!.id,
        p.slug,
        p.name,
        p.city,
        country,
        place.city_slug,
        place.lat,
        place.lng,
        p.accent,
        p.styles,
        p.layout ? JSON.stringify(p.layout) : null,
      ]);
      await tx.query(`insert into members (studio_id, user_id, email, role, locale, artist_id) values ($1, $2, $3, 'owner', $4, $5)`, [
        studio!.id,
        session.userId,
        session.email,
        locale,
        artist!.id,
      ]);
      await tx.query(`insert into tour_stops (studio_id, artist_id, city, country, city_slug, lat, lng, timezone, is_home, status) values ($1, $2, $3, $8, $5, $6, $7, $4, true, 'booking')`, [
        studio!.id,
        artist!.id,
        p.city,
        p.timezone,
        place.city_slug,
        place.lat,
        place.lng,
        country,
      ]);
    });
  } catch (e) {
    if (String(e).includes("unique") || String(e).includes("duplicate")) return { error: t.studio.onboarding.slugTaken, field: "slug" };
    throw e;
  }
  redirect("/studio/pagina");
}
