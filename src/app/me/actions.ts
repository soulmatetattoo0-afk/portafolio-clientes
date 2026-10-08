"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { setLocale } from "@/app/actions/locale";
import { signOut } from "@/lib/auth";
import { requireClient, safeNext } from "@/lib/client";
import { getDb } from "@/lib/db";
import { citySlug, placeCity } from "@/lib/geo";

const UUID = /^[0-9a-f-]{36}$/i;

export interface FormState {
  ok: boolean;
  error: string | null;
}

/** Follow or unfollow an artist. Returns the new state. */
export async function toggleFollow(artistId: string, next?: string): Promise<{ following: boolean }> {
  const me = await requireClient(next);
  if (!UUID.test(artistId)) return { following: false };
  const db = await getDb();
  const had = await db.one(`delete from follows where user_id = $1 and artist_id = $2 returning 1`, [me.userId, artistId]);
  if (!had) await db.query(`insert into follows (user_id, artist_id) values ($1, $2) on conflict do nothing`, [me.userId, artistId]);
  revalidatePath("/me");
  return { following: !had };
}

/** Save or unsave a piece. Returns the new state. */
export async function toggleSave(itemId: string, next?: string): Promise<{ saved: boolean }> {
  const me = await requireClient(next);
  if (!UUID.test(itemId)) return { saved: false };
  const db = await getDb();
  const had = await db.one(`delete from saves where user_id = $1 and portfolio_item_id = $2 returning 1`, [me.userId, itemId]);
  if (!had) await db.query(`insert into saves (user_id, portfolio_item_id) values ($1, $2) on conflict do nothing`, [me.userId, itemId]);
  revalidatePath("/me");
  return { saved: !had };
}

/** Follow or unfollow a city (for a trade). Returns the new state. */
export async function toggleCityFollow(city: string, trade = "tattoo", next?: string): Promise<{ following: boolean }> {
  const me = await requireClient(next);
  const slug = citySlug(city);
  if (!slug) return { following: false };
  const db = await getDb();
  const had = await db.one(`delete from city_follows where user_id = $1 and city_slug = $2 and trade = $3 returning 1`, [me.userId, slug, trade]);
  if (!had) await db.query(`insert into city_follows (user_id, city_slug, trade) values ($1, $2, $3) on conflict do nothing`, [me.userId, slug, trade]);
  revalidatePath("/me");
  return { following: !had };
}

const Profile = z.object({
  name: z.string().trim().min(2).max(120),
  locale: z.enum(["en", "es"]),
  homeCity: z.string().trim().max(120),
});

/** Name, language and home city. The city is pinned when the gazetteer knows it. */
export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireClient("/me/settings");
  const t = dict(await getLocale());
  const parsed = Profile.safeParse({ name: form.get("name"), locale: form.get("locale"), homeCity: form.get("homeCity") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "name") ? t.me.settings.nameRequired : t.common.error };
  const { name, locale, homeCity } = parsed.data;
  const place = homeCity ? placeCity(homeCity) : null;
  const db = await getDb();
  await db.query(`update client_users set name = $2, locale = $3, home_city = $4, city_slug = $5, lat = $6, lng = $7 where user_id = $1`, [
    me.userId, name, locale, homeCity || null, place?.city_slug ?? null, place?.lat ?? null, place?.lng ?? null,
  ]);
  if (locale !== me.locale) await setLocale(locale);
  revalidatePath("/me", "layout");
  return { ok: true, error: null };
}

/** The four alert switches, as one JSON column. */
export async function savePrefs(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireClient("/me/alerts");
  const alerts = { spots: form.get("spots") === "on", books_open: form.get("books_open") === "on", issue: form.get("issue") === "on", new_work: form.get("new_work") === "on" };
  const db = await getDb();
  await db.query(`update client_users set alerts = $2 where user_id = $1`, [me.userId, JSON.stringify(alerts)]);
  revalidatePath("/me/alerts");
  return { ok: true, error: null };
}

/**
 * Delete the account: the person's own rows go, the studios' client records
 * are unlinked. Briefs, quotes and appointments stay: they are the studio's record.
 */
export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireClient("/me/settings");
  const t = dict(await getLocale());
  const typed = String(form.get("confirm") ?? "").trim();
  const expected = (me.name ?? me.email).trim();
  if (!typed || typed.localeCompare(expected, undefined, { sensitivity: "base" }) !== 0) return { ok: false, error: t.me.settings.confirmMismatch };
  const db = await getDb();
  await db.tx(async (tx) => {
    await tx.query(`delete from follows where user_id = $1`, [me.userId]);
    await tx.query(`delete from saves where user_id = $1`, [me.userId]);
    await tx.query(`delete from city_follows where user_id = $1`, [me.userId]);
    await tx.query(`update clients set user_id = null where user_id = $1`, [me.userId]);
    await tx.query(`delete from client_users where user_id = $1`, [me.userId]);
  });
  await signOut();
  redirect("/");
}

/** Sign the client out and go home, or back to the page named in the form. */
export async function signOutClient(form?: FormData) {
  await signOut();
  redirect(safeNext(form?.get("next"), "/"));
}
