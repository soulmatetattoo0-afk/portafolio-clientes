import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/client";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { ensureGuest, GUEST_COOKIE, sealGuest } from "@/lib/guest";
import { allow } from "@/lib/ratelimit";

/**
 * Become a guest: a visitor who needs an account (to book, to chat) gets one
 * on their device without a form, and lands where they were going.
 */
export async function GET(request: Request) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const go = () => Response.redirect(new URL(next, request.url), 303);
  if (!live.auth) return go();
  const session = await getSession();
  if (session?.guest) {
    // Their device already carries a guest account: make sure its row is there.
    await ensureGuest(await getDb(), session.userId, await getLocale());
    return go();
  }
  if (session) return go();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (!(await allow(`guest:${ip}`, 20, 3600))) return Response.redirect(new URL(`/me/signin?real=1&next=${encodeURIComponent(next)}`, request.url), 303);
  const id = randomUUID();
  const db = await getDb();
  await ensureGuest(db, id, await getLocale());
  // Made on an artist's page (to book, to follow): that artist starts their "Mis artistas".
  const slug = next.split(/[/?#]/)[1] ?? "";
  if (slug) await db.query(`insert into artist_visits (user_id, artist_id) select $1, id from artists where slug = $2 on conflict do nothing`, [id, slug.toLowerCase()]);
  (await cookies()).set(GUEST_COOKIE, sealGuest(id), { httpOnly: true, sameSite: "lax", secure: env.appUrl.startsWith("https"), path: "/", maxAge: 60 * 60 * 24 * 365 });
  return go();
}
