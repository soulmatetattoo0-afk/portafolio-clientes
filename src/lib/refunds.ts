import type { Db } from "./db";
import { artistToken, refundPayment } from "./mercadopago";

/**
 * Give a booked session's deposit back. Paid with Mercado Pago, the money
 * returns to the client's card or account through the artist's Mercado Pago
 * (VANTA's share with it). Paid directly, the artist hands it back themself and
 * the app only records it. Returns what happened.
 */
export async function refundDeposit(db: Db, a: { studioId: string; artistId: string; appointmentId: string; quoteId: string | null }): Promise<"mercadopago" | "manual" | "none" | "failed"> {
  const pay = await db.one<{ id: string; provider: string; payment_intent_id: string | null }>(
    `select id, provider, payment_intent_id from payments
      where studio_id = $1 and kind = 'deposit' and status = 'paid' and (appointment_id = $2 or ($3::uuid is not null and quote_id = $3::uuid))
      order by created_at desc limit 1`,
    [a.studioId, a.appointmentId, a.quoteId],
  );
  if (!pay) return "none";
  if (pay.provider === "mercadopago" && pay.payment_intent_id) {
    const token = await artistToken(db, a.artistId);
    if (!token) return "failed";
    try {
      await refundPayment(token, pay.payment_intent_id);
    } catch (e) {
      console.error("mp refund failed", pay.id, e);
      return "failed";
    }
  }
  await db.query(`update payments set status = 'refunded' where id = $1`, [pay.id]);
  return pay.provider === "mercadopago" ? "mercadopago" : "manual";
}
