import type Stripe from "stripe";

import { confirmBooking } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { flushOutbox } from "@/lib/email";
import { verifyWebhook } from "@/lib/payments";

/**
 * Stripe Connect webhook (subscribe the endpoint to events "on connected accounts"):
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.expired, account.updated.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = await getDb();
  const fresh = await db.one(`insert into webhook_events (id, type) values ($1, $2) on conflict (id) do nothing returning id`, [event.id, event.type]);
  if (!fresh) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== "paid") break;
        const quoteId = s.metadata?.quote_id;
        const slotId = s.metadata?.slot_id;
        if (!quoteId || !slotId) break;
        const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
        const pending = await db.one<{ application_fee_cents: number }>(`select application_fee_cents from payments where checkout_id = $1`, [s.id]);
        await confirmBooking(db, {
          quoteId,
          slotId,
          provider: "stripe",
          checkoutId: s.id,
          paymentIntentId: pi,
          amountCents: s.amount_total ?? 0,
          currency: s.currency ?? "usd",
          feeCents: pending?.application_fee_cents ?? 0,
        });
        await flushOutbox(db);
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        await db.query(`update payments set status = 'failed' where checkout_id = $1 and status = 'pending'`, [s.id]);
        if (s.metadata?.slot_id) {
          await db.query(`update quote_slots set status = 'offered', hold_expires_at = null where id = $1 and status = 'held'`, [s.metadata.slot_id]);
        }
        break;
      }
      case "account.updated": {
        const a = event.data.object as Stripe.Account;
        await db.query(`update artists set stripe_charges_enabled = $2 where stripe_account_id = $1`, [a.id, Boolean(a.charges_enabled)]);
        break;
      }
    }
  } catch (e) {
    // Let Stripe retry: forget the event id so the retry is processed.
    await db.query(`delete from webhook_events where id = $1`, [event.id]);
    console.error("stripe webhook failed", event.type, e);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
