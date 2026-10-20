import type Stripe from "stripe";

import { getDb } from "@/lib/db";
import { verifyBillingWebhook } from "@/lib/payments";

/**
 * Stripe webhook for VANTA's own account (a separate endpoint from the
 * Connect one): the artists' subscriptions to VANTA Full. Events:
 * checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = verifyBillingWebhook(raw, request.headers.get("stripe-signature"));
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = await getDb();
  const fresh = await db.one(`insert into webhook_events (id, type) values ($1, $2) on conflict (id) do nothing returning id`, [event.id, event.type]);
  if (!fresh) return Response.json({ received: true, duplicate: true });
  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && s.metadata?.studio_id) {
        const customer = typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);
        await db.query(`update studios set plan = 'full', subscription_status = 'active', stripe_customer_id = coalesce($2, stripe_customer_id) where id = $1`, [s.metadata.studio_id, customer]);
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const studioId = sub.metadata?.studio_id;
      if (studioId) {
        const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
        await db.query(`update studios set subscription_status = $2, plan = case when $2 = 'canceled' then 'basic' else plan end where id = $1 and plan not in ('founding')`, [studioId, status]);
      }
    }
  } catch (e) {
    await db.query(`delete from webhook_events where id = $1`, [event.id]);
    console.error("billing webhook failed", event.type, e);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
