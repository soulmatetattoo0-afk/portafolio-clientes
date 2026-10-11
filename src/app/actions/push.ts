"use server";

import { z } from "zod";

import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Keep this browser's push subscription for the signed-in person (client or artist). */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const session = await getSession();
  const sub = Sub.safeParse(input);
  if (!session || !sub.success) return { ok: false };
  const db = await getDb();
  await db.query(
    `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [sub.data.endpoint, session.userId, sub.data.keys.p256dh, sub.data.keys.auth],
  );
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const session = await getSession();
  if (!session) return;
  const db = await getDb();
  await db.query(`delete from push_subscriptions where endpoint = $1 and user_id = $2`, [endpoint, session.userId]);
}
