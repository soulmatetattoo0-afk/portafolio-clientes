import { confirmBooking } from "./booking";
import type { Db } from "./db";
import { demoMode } from "./env";

/**
 * The demo's client books on their own: thirty seconds after the artist
 * sends a quote, the booking payment "arrives" and the session lands in the
 * calendar, so the artist sees the whole road without a second phone.
 * Called when the artist opens the chat; does nothing outside demo mode.
 */
export async function demoAutoBook(db: Db, studioId: string, briefId: string): Promise<boolean> {
  if (!demoMode) return false;
  const q = await db.one<{ id: string; slot_id: string; deposit_cents: number; currency: string }>(
    `select q.id, s.id as slot_id, q.deposit_cents, q.currency
       from quotes q join quote_slots s on s.quote_id = q.id
      where q.brief_id = $1 and q.studio_id = $2 and q.status in ('sent', 'viewed') and s.status = 'offered' and q.created_at < now() - interval '30 seconds'
      order by q.created_at desc limit 1`,
    [briefId, studioId],
  );
  if (!q) return false;
  await db.query(`update quotes set accepted_at = now() where id = $1`, [q.id]);
  await confirmBooking(db, { quoteId: q.id, slotId: q.slot_id, provider: "demo", checkoutId: `demo_auto_${q.id}`, amountCents: q.deposit_cents, currency: q.currency });
  return true;
}
