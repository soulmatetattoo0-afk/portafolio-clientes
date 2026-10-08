/**
 * The signed-in client: the person looking for an artist. Separate from
 * studio members (an artist can be both). Every query here scopes by the
 * user's id; the row policies in 0007 are the second wall.
 */
import { redirect } from "next/navigation";

import { getDb } from "./db";
import { getSession, type Session } from "./auth";

export interface ClientUser {
  userId: string;
  email: string;
  name: string | null;
  locale: "en" | "es";
  homeCity: string | null;
  citySlug: string | null;
  alerts: { spots: boolean; books_open: boolean; issue: boolean; new_work: boolean };
}

export async function getClientUser(session?: Session | null): Promise<ClientUser | null> {
  const s = session ?? (await getSession());
  if (!s) return null;
  const db = await getDb();
  const row = await db.one<{ user_id: string; email: string; name: string | null; locale: "en" | "es"; home_city: string | null; city_slug: string | null; alerts: ClientUser["alerts"] }>(
    `select user_id, email, name, locale, home_city, city_slug, alerts from client_users where user_id = $1`,
    [s.userId],
  );
  if (!row) return null;
  return { userId: row.user_id, email: row.email, name: row.name, locale: row.locale, homeCity: row.home_city, citySlug: row.city_slug, alerts: row.alerts };
}

/** Gate for every client page and action: signed in as a client, else to sign-in with a way back. */
export async function requireClient(next?: string): Promise<ClientUser> {
  const me = await getClientUser();
  if (!me) redirect(`/me/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return me;
}

/**
 * First sign-in: create the client row and claim the studios' client records
 * made with this email (briefs, quotes and appointments follow them).
 */
export async function ensureClientUser(userId: string, email: string, locale: "en" | "es" = "en"): Promise<void> {
  const db = await getDb();
  await db.query(
    `insert into client_users (user_id, email, locale) values ($1, $2, $3)
       on conflict (user_id) do update set email = excluded.email`,
    [userId, email, locale],
  );
  await db.query(`update clients set user_id = $1 where lower(email) = lower($2) and user_id is null`, [userId, email]);
}

export async function followedIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ artist_id: string }>(`select artist_id from follows where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.artist_id));
}

export async function isFollowing(userId: string, artistId: string): Promise<boolean> {
  const db = await getDb();
  return Boolean(await db.one(`select 1 from follows where user_id = $1 and artist_id = $2`, [userId, artistId]));
}

export async function savedIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ portfolio_item_id: string }>(`select portfolio_item_id from saves where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.portfolio_item_id));
}

export async function followedCities(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ city_slug: string }>(`select city_slug from city_follows where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.city_slug));
}
