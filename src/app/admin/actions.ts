"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { placeCity } from "@/lib/geo";

const PLANS = ["basic", "full", "founding"] as const;

/** Phase 1 billing: the house sets a studio's tier by hand. */
export async function setPlan(studioId: string, plan: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = z.object({ studioId: z.string().uuid(), plan: z.enum(PLANS) }).safeParse({ studioId, plan });
  if (!parsed.success) return { ok: false };
  const db = await getDb();
  await db.query(`update studios set plan = $2 where id = $1`, [parsed.data.studioId, parsed.data.plan]);
  revalidatePath("/admin/plans");
  revalidatePath("/studio", "layout");
  return { ok: true };
}

/** Pin every artist and stop whose city has no place yet; cities the gazetteer doesn't know keep a slug and no coordinates. */
export async function regeocode() {
  await requireAdmin();
  const db = await getDb();
  let n = 0;
  const artists = await db.query<{ id: string; home_city: string; country: string | null }>(`select id, home_city, country from artists where city_slug is null and coalesce(home_city, '') <> ''`);
  for (const a of artists) {
    const p = placeCity(a.home_city, a.country);
    await db.query(`update artists set city_slug = $2, lat = $3, lng = $4 where id = $1`, [a.id, p.city_slug, p.lat, p.lng]);
    n++;
  }
  const stops = await db.query<{ id: string; city: string; country: string | null }>(`select id, city, country from tour_stops where city_slug is null`);
  for (const s of stops) {
    const p = placeCity(s.city, s.country);
    await db.query(`update tour_stops set city_slug = $2, lat = $3, lng = $4 where id = $1`, [s.id, p.city_slug, p.lat, p.lng]);
    n++;
  }
  revalidatePath("/admin/plans");
  redirect(`/admin/plans?geocoded=${n}`);
}
