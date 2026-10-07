"use server";

import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { allow } from "@/lib/ratelimit";

export interface WaitlistState {
  ok: boolean;
  message: string | null;
}

const Input = z.object({
  artistId: z.string().uuid(),
  stopId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(200),
});

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  const locale = await getLocale();
  const t = dict(locale);
  const parsed = Input.safeParse({ artistId: form.get("artistId"), stopId: form.get("stopId"), email: form.get("email") });
  if (!parsed.success) return { ok: false, message: t.brief.contact.emailInvalid };
  if (!(await allow("waitlist", 10, 3600))) return { ok: false, message: t.common.error };
  const db = await getDb();
  const stop = await db.one<{ studio_id: string; city: string }>(`select studio_id, city from tour_stops where id = $1 and artist_id = $2`, [
    parsed.data.stopId,
    parsed.data.artistId,
  ]);
  if (!stop) return { ok: false, message: t.common.error };
  await db.query(
    `insert into waitlist (studio_id, artist_id, tour_stop_id, city, email, locale) values ($1, $2, $3, $4, $5, $6)
     on conflict (artist_id, lower(email), lower(city)) do update set tour_stop_id = excluded.tour_stop_id, notified_at = null`,
    [stop.studio_id, parsed.data.artistId, parsed.data.stopId, stop.city, parsed.data.email, locale],
  );
  return { ok: true, message: fill(t.artist.waitlistDone, { city: stop.city }) };
}
