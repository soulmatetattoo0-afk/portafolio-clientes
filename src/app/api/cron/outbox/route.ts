import { getDb } from "@/lib/db";
import { flushOutbox } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Scheduled job: sends due emails (reminders) and frees dates whose payment
 * hold ran out. Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = await getDb();
  const released = await db.query(`update quote_slots set status = 'offered', hold_expires_at = null where status = 'held' and hold_expires_at < now() returning id`);
  await db.query(`update quotes set status = 'expired' where status in ('sent', 'viewed') and expires_at < now()`);
  let sent = 0;
  for (let i = 0; i < 8; i++) {
    const n = await flushOutbox(db, 50);
    sent += n;
    if (n < 50) break;
  }
  return Response.json({ sent, released: released.length });
}
