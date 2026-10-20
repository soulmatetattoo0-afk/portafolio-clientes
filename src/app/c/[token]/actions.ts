"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { loadBalance, recordBalance } from "@/lib/balance";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { demoMode, env, live } from "@/lib/env";
import { chatToArtist } from "@/lib/messages";
import { createDepositCheckout } from "@/lib/payments";
import { feeBpsFor } from "@/lib/plan";
import { notifyEach } from "@/lib/push";
import { zonedToUtc } from "@/lib/format";
import { allow } from "@/lib/ratelimit";

const Body = z.string().trim().min(1).max(3000);

/** The client writes to the artist. The private link is the key; nothing else is asked. */
export async function sendClientMessage(chatToken: string, text: string): Promise<{ error?: string } | void> {
  const t = dict(await getLocale());
  const body = Body.safeParse(text);
  if (!body.success || !/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return { error: t.common.error };
  if (!(await allow(`chat:${chatToken}`, 30, 3600))) return { error: t.common.error };
  const db = await getDb();
  const b = await db.one<{ id: string; studio_id: string; status: string; client_name: string; artist_name: string; owner_email: string | null; owner_locale: "en" | "es" | null }>(
    `select b.id, b.studio_id, b.status, c.name as client_name, a.display_name as artist_name,
            (select m.email from members m where m.studio_id = b.studio_id order by (m.role = 'owner') desc limit 1) as owner_email,
            (select m.locale from members m where m.studio_id = b.studio_id order by (m.role = 'owner') desc limit 1) as owner_locale
       from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id where b.chat_token = $1`,
    [chatToken],
  );
  if (!b || b.status === "archived" || b.status === "declined") return { error: t.common.error };
  // The conversation opens for the client once the artist has answered the request.
  const answered = await db.one(`select 1 from brief_events where brief_id = $1 and actor = 'artist' limit 1`, [b.id]);
  if (!answered) return { error: t.common.error };
  // Did the artist already have something unread from this client? Then one email is enough.
  const unread = await db.one(
    `select 1 from brief_events e join briefs b on b.id = e.brief_id
      where e.brief_id = $1 and e.actor = 'client' and e.kind = 'message' and e.created_at > coalesce(b.artist_read_at, b.created_at)`,
    [b.id],
  );
  await db.tx(async (tx) => {
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'message', 'client', $3)`, [b.studio_id, b.id, body.data]);
    await tx.query(`update briefs set client_read_at = now(), updated_at = now(), status = case when status = 'needs_info' then 'new' else status end where id = $1`, [b.id]);
  });
  // The artist hears on their phone, every message (one notification per conversation, replaced as it grows).
  const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [b.studio_id]);
  after(() => notifyEach(members, (l) => ({ title: fill(dict(l).push.newMessageFrom, { name: b.client_name }), body: body.data, url: `/studio/chats/${b.id}`, tag: `chat:${b.id}` })));
  if (!unread && b.owner_email) {
    await enqueueEmail(db, chatToArtist({ to: b.owner_email, client: b.client_name, artist: b.artist_name, message: body.data, briefId: b.id, locale: b.owner_locale ?? "en" }), {
      studioId: b.studio_id,
      template: "chat_artist",
    });
    after(async () => {
      await flushOutbox(await getDb());
    });
  }
  revalidatePath(`/c/${chatToken}`);
}

/** Opening the conversation marks it read for the client. */
export async function markClientRead(chatToken: string) {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return;
  const db = await getDb();
  await db.query(`update briefs set client_read_at = now() where chat_token = $1`, [chatToken]);
}

/**
 * The client picks a day in the artist's calendar: the quote gets its slot on
 * that day at the artist's usual hour, and the client goes on to the deposit.
 */
export async function pickOfferDay(chatToken: string, quoteToken: string, day: string): Promise<{ url: string } | { error: string }> {
  const t = dict(await getLocale());
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(chatToken) || !/^[A-Za-z0-9_-]{24,80}$/.test(quoteToken) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: t.common.error };
  if (!(await allow(`pick:${chatToken}`, 20, 3600))) return { error: t.common.error };
  const db = await getDb();
  const q = await db.one<{ id: string; studio_id: string; artist_id: string; status: string; expires_at: Date; pick_time: string | null; pick_until: string | null; stop_id: string | null; timezone: string | null; hours: number | null; closed_weekdays: number[] }>(
    `select q.id, q.studio_id, q.artist_id, q.status, q.expires_at, q.pick_time, to_char(q.pick_until, 'YYYY-MM-DD') as pick_until, q.pick_stop_id as stop_id, st.timezone,
            q.hours_per_session::float as hours, a.closed_weekdays
       from quotes q join briefs b on b.id = q.brief_id join artists a on a.id = q.artist_id left join tour_stops st on st.id = q.pick_stop_id
      where q.token = $1 and b.chat_token = $2`,
    [quoteToken, chatToken],
  );
  if (!q || !q.pick_time || !q.timezone || !["sent", "viewed"].includes(q.status) || new Date(q.expires_at).getTime() < Date.now()) return { error: t.chat.offer.expired };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: q.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const weekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  if (day <= today || (q.pick_until && day > q.pick_until) || (q.closed_weekdays ?? []).map(Number).includes(weekday)) return { error: t.chat.offer.pickTaken };
  const off = await db.one(`select 1 from days_off where artist_id = $1 and day = $2::date`, [q.artist_id, day]);
  if (off) return { error: t.chat.offer.pickTaken };
  const start = zonedToUtc(day, q.pick_time, q.timezone);
  const end = new Date(start.getTime() + (q.hours ?? 3) * 3600_000);
  const clash = await db.one(
    `select 1 from appointments where artist_id = $1 and status = 'confirmed' and tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)
     union all
     select 1 from quote_slots s join quotes qq on qq.id = s.quote_id where qq.artist_id = $1 and s.status in ('held', 'booked') and tstzrange(s.starts_at, s.ends_at) && tstzrange($2::timestamptz, $3::timestamptz)`,
    [q.artist_id, start.toISOString(), end.toISOString()],
  );
  if (clash) return { error: t.chat.offer.pickTaken };
  await db.tx(async (tx) => {
    // One slot per calendar offer: picking again replaces an unpaid pick.
    await tx.query(`update quote_slots set status = 'released' where quote_id = $1 and status in ('offered', 'held')`, [q.id]);
    await tx.query(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id) values ($1, $2, $3, $4, $5, $6)`, [
      q.studio_id, q.id, start.toISOString(), end.toISOString(), q.timezone, q.stop_id,
    ]);
  });
  revalidatePath(`/c/${chatToken}`);
  return { url: `/q/${quoteToken}` };
}

/**
 * The client pays the rest of the tattoo from the chat, once the session has
 * started. The money goes to the artist's Stripe account with VANTA's fee; in
 * demo mode it is recorded at once.
 */
export async function payBalance(chatToken: string): Promise<{ url: string } | { error: string }> {
  const locale = await getLocale();
  const t = dict(locale);
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return { error: t.common.error };
  if (!(await allow(`balance:${chatToken}`, 10, 3600))) return { error: t.common.error };
  const db = await getDb();
  const b = await db.one<{ id: string; studio_id: string; artist_name: string; client_email: string | null; stripe_account_id: string | null; stripe_charges_enabled: boolean; plan: string | null }>(
    `select b.id, b.studio_id, a.display_name as artist_name, c.email as client_email, a.stripe_account_id, a.stripe_charges_enabled, s.plan
       from briefs b join artists a on a.id = b.artist_id join clients c on c.id = b.client_id join studios s on s.id = b.studio_id
      where b.chat_token = $1`,
    [chatToken],
  );
  if (!b) return { error: t.common.error };
  const balance = await loadBalance(db, b.id);
  if (!balance || balance.paid) return { error: t.chat.balance.done };
  if (!balance.open) return { error: t.chat.balance.notYet };
  if (!balance.amountCents) return { error: fill(t.chat.balance.waiting, { artist: b.artist_name }) };

  if (!live.payments && !demoMode) return { error: fill(t.chat.direct.balance, { artist: b.artist_name, amount: "" }) };
  if (!live.payments) {
    await recordBalance(db, { appointmentId: balance.appointmentId, provider: "demo", checkoutId: `demo_${randomUUID()}`, amountCents: balance.amountCents, currency: balance.currency });
    revalidatePath(`/c/${chatToken}`);
    return { url: `/c/${chatToken}` };
  }
  if (!b.stripe_account_id || !b.stripe_charges_enabled) return { error: fill(t.quote.paymentsOff, { artist: b.artist_name }) };
  const q = await db.one<{ quote_id: string }>(`select quote_id from appointments where id = $1`, [balance.appointmentId]);
  const checkout = await createDepositCheckout({
    accountId: b.stripe_account_id,
    amountCents: balance.amountCents,
    currency: balance.currency,
    description: fill(t.chat.balance.item, { artist: b.artist_name }),
    customerEmail: b.client_email ?? "",
    quoteId: q!.quote_id,
    studioId: b.studio_id,
    kind: "balance",
    appointmentId: balance.appointmentId,
    successUrl: `${env.appUrl}/c/${chatToken}?balance=success`,
    cancelUrl: `${env.appUrl}/c/${chatToken}`,
    locale,
    feeBps: feeBpsFor(b.plan, { basic: env.platformFeeBps, full: env.platformFeeFullBps }),
  });
  await db.query(
    `insert into payments (studio_id, quote_id, appointment_id, provider, checkout_id, amount_cents, application_fee_cents, currency, status, kind)
     values ($1, $2, $3, 'stripe', $4, $5, $6, $7, 'pending', 'balance') on conflict (checkout_id) do nothing`,
    [b.studio_id, q!.quote_id, balance.appointmentId, checkout.id, balance.amountCents, checkout.fee, balance.currency],
  );
  return { url: checkout.url };
}
