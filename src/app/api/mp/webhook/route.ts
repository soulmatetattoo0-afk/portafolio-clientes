import { recordBalance } from "@/lib/balance";
import { confirmBooking } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { flushOutbox } from "@/lib/email";
import { artistToken, checkoutIdOf, getPayment, getSubscription, readRef, verifyNotification } from "@/lib/mercadopago";

/**
 * Mercado Pago notifications. Payments arrive with `?a=<artist>` (the
 * preference names it) and are re-read from the API with that artist's token,
 * so nothing in the notification itself is trusted; VANTA Pro subscriptions
 * (preapprovals) arrive from VANTA's own application and are read with its token.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const raw = await request.text();
  let body: { type?: string; topic?: string; data?: { id?: string | number } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    // Older notifications carry everything in the query.
  }
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return Response.json({ received: true });
  if (!verifyNotification(request.headers, url.searchParams.get("data.id") ?? id)) return new Response("Invalid signature", { status: 401 });

  const db = await getDb();
  try {
    if (type === "payment") await onPayment(db, url.searchParams.get("a"), id);
    else if (type === "subscription_preapproval" || type === "preapproval") await onSubscription(db, id);
  } catch (e) {
    console.error("mp webhook failed", type, id, e);
    // Mercado Pago retries what is not answered with 2xx.
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

type Db = Awaited<ReturnType<typeof getDb>>;

async function onPayment(db: Db, artistId: string | null, paymentId: string) {
  if (!artistId || !/^[0-9a-f-]{36}$/.test(artistId)) return;
  const token = await artistToken(db, artistId);
  if (!token) return;
  const p = await getPayment(token, paymentId);
  const ref = readRef(p.external_reference);
  if (!ref) return;
  // Our own row, made before the client left for Mercado Pago, and for this artist.
  const row = await db.one<{ amount_cents: number; application_fee_cents: number; currency: string; status: string }>(
    `select p.amount_cents, p.application_fee_cents, p.currency, p.status
       from payments p join quotes q on q.id = p.quote_id
      where p.checkout_id = $1 and q.artist_id = $2`,
    [checkoutIdOf(ref), artistId],
  );
  if (!row) return;

  if (p.status === "approved") {
    if (ref.kind === "deposit") {
      await confirmBooking(db, {
        quoteId: ref.quoteId,
        slotId: ref.slotId,
        provider: "mercadopago",
        checkoutId: checkoutIdOf(ref),
        paymentIntentId: String(p.id),
        amountCents: row.amount_cents,
        currency: row.currency,
        feeCents: row.application_fee_cents,
      });
    } else {
      await recordBalance(db, {
        appointmentId: ref.appointmentId,
        provider: "mercadopago",
        checkoutId: checkoutIdOf(ref),
        paymentIntentId: String(p.id),
        amountCents: row.amount_cents,
        currency: row.currency,
        feeCents: 0,
      });
    }
    await flushOutbox(db);
  } else if (p.status === "rejected" || p.status === "cancelled") {
    await db.query(`update payments set status = 'failed' where checkout_id = $1 and status = 'pending'`, [checkoutIdOf(ref)]);
    if (ref.kind === "deposit") await db.query(`update quote_slots set status = 'offered', hold_expires_at = null where id = $1 and status = 'held'`, [ref.slotId]);
  } else if (p.status === "refunded" || p.status === "charged_back") {
    await db.query(`update payments set status = 'refunded' where checkout_id = $1 and status = 'paid'`, [checkoutIdOf(ref)]);
  }
}

/** VANTA Pro: authorised turns the studio Pro; cancelled or paused takes it back to the free plan. */
async function onSubscription(db: Db, preapprovalId: string) {
  const sub = await getSubscription(preapprovalId);
  const studioId = sub.external_reference;
  if (!studioId || !/^[0-9a-f-]{36}$/.test(studioId)) return;
  if (sub.status === "authorized") {
    await db.query(`update studios set plan = 'full', subscription_status = 'active', mp_preapproval_id = $2 where id = $1 and plan <> 'founding'`, [studioId, sub.id]);
  } else if (sub.status === "cancelled" || sub.status === "paused") {
    await db.query(
      `update studios set subscription_status = 'canceled', plan = case when plan = 'founding' then plan else 'basic' end where id = $1 and mp_preapproval_id = $2`,
      [studioId, sub.id],
    );
  }
}
