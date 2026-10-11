import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";

import { getDb } from "./db";
import { env } from "./env";

/**
 * Notifications that reach a phone or a computer with the app closed: the
 * browser hands us a subscription, we sign each message with our VAPID key.
 * Production sets the key pair in the environment; local mode makes one and
 * keeps it in .data so subscriptions survive restarts.
 */
let keys: { publicKey: string; privateKey: string } | null = null;

export function vapidKeys() {
  if (keys) return keys;
  if (env.vapidPublicKey && env.vapidPrivateKey) keys = { publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey };
  else {
    const file = path.join(process.env.VERCEL ? "/tmp/brief-data" : path.join(process.cwd(), ".data"), "vapid.json");
    try {
      keys = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      keys = webpush.generateVAPIDKeys();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(keys));
    }
  }
  return keys!;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap on the notification opens. */
  url: string;
  /** Notifications with the same tag replace each other (one per conversation). */
  tag?: string;
}

/** Send to every device these people allowed. Gone subscriptions are cleaned up; failures never break the action. */
export async function notify(userIds: (string | null | undefined)[], msg: PushMessage) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  const db = await getDb();
  const subs = await db.query<{ endpoint: string; p256dh: string; auth: string }>(`select endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])`, [ids]);
  if (!subs.length) return;
  const { publicKey, privateKey } = vapidKeys();
  const payload = JSON.stringify({ ...msg, body: msg.body.length > 160 ? `${msg.body.slice(0, 157)}…` : msg.body });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: { subject: env.vapidSubject, publicKey, privateKey },
          TTL: 60 * 60 * 24,
        });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.query(`delete from push_subscriptions where endpoint = $1`, [s.endpoint]);
      }
    }),
  );
}
