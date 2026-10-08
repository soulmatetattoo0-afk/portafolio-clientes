"use server";

import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/client";
import { getDb } from "@/lib/db";
import { citySlug } from "@/lib/geo";

const UUID = /^[0-9a-f-]{36}$/i;

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
