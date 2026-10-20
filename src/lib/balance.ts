import { dict, fill } from "@/i18n";

import type { Db } from "./db";
import { money } from "./format";
import { sendCareSheet } from "./care";
import { emailChat } from "./chat-email";
import { notify, notifyEach } from "./push";

/**
 * The rest of the tattoo, paid in the chat. Once the session has started the
 * client's chat shows "Pay the remaining amount": the amount the artist set
 * for the appointment, or, when the estimate was a single price, that price
 * less the deposit. The money goes to the artist's own Stripe account, with
 * VANTA's fee taken on the way, like the deposit.
 */
export interface Balance {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  /** What is left to pay; null until the artist sets it on a ranged estimate. */
  amountCents: number | null;
  currency: string;
  /** The deposit already paid, for the artist's note. */
  depositCents: number;
  /** The session has started: the client can pay. */
  open: boolean;
  /** The artist marked the session done and asked for the rest. */
  requested: boolean;
  paid: boolean;
}

/** The balance of the brief's latest booked session, if it has one. */
export async function loadBalance(db: Db, briefId: string): Promise<Balance | null> {
  const r = await db.one<{
    id: string;
    starts_at: Date;
    ends_at: Date;
    balance_cents: number | null;
    price_min_cents: number;
    price_max_cents: number | null;
    deposit_cents: number;
    currency: string;
    paid: boolean;
    status: string;
  }>(
    `select ap.id, ap.starts_at, ap.ends_at, ap.balance_cents, ap.status, q.price_min_cents, q.price_max_cents, q.deposit_cents, q.currency,
            exists (select 1 from payments p where p.appointment_id = ap.id and p.kind = 'balance' and p.status = 'paid') as paid
       from appointments ap join quotes q on q.id = ap.quote_id
      where ap.brief_id = $1 and ap.status in ('confirmed', 'completed')
      order by ap.starts_at desc limit 1`,
    [briefId],
  );
  if (!r) return null;
  const fixed = r.price_max_cents === null || r.price_max_cents === r.price_min_cents;
  const amount = r.balance_cents ?? (fixed ? Math.max(0, r.price_min_cents - r.deposit_cents) : null);
  const starts = new Date(r.starts_at);
  return {
    appointmentId: r.id,
    startsAt: starts.toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    amountCents: amount,
    currency: r.currency,
    depositCents: r.deposit_cents,
    open: r.status === "completed" || Date.now() >= starts.getTime(),
    requested: r.status === "completed",
    paid: Boolean(r.paid),
  };
}

interface RecordArgs {
  appointmentId: string;
  provider: "stripe" | "demo" | "manual";
  checkoutId: string;
  paymentIntentId?: string | null;
  amountCents: number;
  currency: string;
  feeCents?: number;
}

/** Record a paid balance once (webhooks can repeat), tell both sides in the chat and by push. */
export async function recordBalance(db: Db, a: RecordArgs) {
  const fresh = await db.tx(async (tx) => {
    const done = await tx.one(`select 1 from payments where checkout_id = $1 and status = 'paid'`, [a.checkoutId]);
    if (done) return null;
    const ap = await tx.one<{ studio_id: string; quote_id: string; brief_id: string }>(
      `select studio_id, quote_id, brief_id from appointments where id = $1 for update`,
      [a.appointmentId],
    );
    if (!ap) throw new Error("appointment_not_found");
    await tx.query(
      `insert into payments (studio_id, quote_id, appointment_id, provider, checkout_id, payment_intent_id, amount_cents, application_fee_cents, currency, status, kind)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'paid', 'balance')
       on conflict (checkout_id) do update set status = 'paid', payment_intent_id = excluded.payment_intent_id`,
      [ap.studio_id, ap.quote_id, a.appointmentId, a.provider, a.checkoutId, a.paymentIntentId ?? null, a.amountCents, a.feeCents ?? 0, a.currency],
    );
    await tx.query(`update appointments set status = 'completed' where id = $1 and status = 'confirmed'`, [a.appointmentId]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, data) values ($1, $2, 'balance_paid', 'client', $3)`, [
      ap.studio_id,
      ap.brief_id,
      JSON.stringify({ amount_cents: a.amountCents, currency: a.currency, appointment_id: a.appointmentId }),
    ]);
    return ap;
  });
  if (!fresh) return;
  const who = await db.one<{ client: string; client_user: string | null; client_locale: "en" | "es"; artist: string; chat_token: string | null }>(
    `select c.name as client, c.user_id as client_user, c.locale as client_locale, ar.display_name as artist, b.chat_token
       from appointments ap join clients c on c.id = ap.client_id join artists ar on ar.id = ap.artist_id join briefs b on b.id = ap.brief_id
      where ap.id = $1`,
    [a.appointmentId],
  );
  if (!who) return;
  // Paid in full: the after-care sheet goes to the chat.
  await sendCareSheet(db, fresh.brief_id, "post").catch(() => undefined);
  const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [fresh.studio_id]);
  const amount = (l: "en" | "es") => money(a.amountCents, a.currency, l);
  await notifyEach(members, (l) => ({ title: fill(dict(l).push.balancePaid, { name: who.client }), body: amount(l), url: `/studio/chats/${fresh.brief_id}`, tag: `balance:${a.appointmentId}` }));
  if (a.provider !== "manual") await emailChat(db, fresh.brief_id, "artist", "paid", amount("es"));
  await notify([who.client_user], {
    title: fill(dict(who.client_locale).push.balanceThanks, { name: who.artist }),
    body: amount(who.client_locale),
    url: who.chat_token ? `/c/${who.chat_token}` : "/me",
    tag: `balance:${a.appointmentId}`,
  });
}
