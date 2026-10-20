"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { confirmBooking } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { flushOutbox } from "@/lib/email";
import { env, live, paysDirect } from "@/lib/env";
import { money } from "@/lib/format";
import { emailChat } from "@/lib/chat-email";
import { notifyEach } from "@/lib/push";
import { createDepositCheckout } from "@/lib/payments";
import { feeBpsFor } from "@/lib/plan";
import { placementLabel } from "@/lib/messages";
import { getQuoteByToken } from "@/lib/queries";

export interface PayState {
  error: string | null;
}

export async function startDeposit(token: string, _prev: PayState, form: FormData): Promise<PayState> {
  const locale = await getLocale();
  const t = dict(locale);
  const quote = await getQuoteByToken(token);
  if (!quote) return { error: t.common.error };
  const q = t.quote;
  if (quote.status === "withdrawn") return { error: fill(q.withdrawn, { artist: quote.artist_name }) };
  const back = form.get("from") === "studio" ? "?from=studio" : "";
  if (quote.status === "paid") redirect(`/q/${token}${back}`);
  if (new Date(quote.expires_at).getTime() < Date.now()) return { error: q.expired };
  if (form.get("agree") !== "on") return { error: q.agreeRequired };
  const slotId = String(form.get("slot") ?? "");
  if (!quote.slots.some((s) => s.id === slotId)) return { error: q.dateRequired };

  const db = await getDb();
  // Hold the date while the client pays: 30 minutes on a card, a week when the artist confirms a direct payment.
  // Card payments only once the artist's own Stripe can take them; until then the client pays them directly.
  const direct = paysDirect(quote.stripe_charges_enabled);
  const held = await db.one(
    `update quote_slots set status = 'held', hold_expires_at = now() + ${direct ? "interval '7 days'" : "interval '31 minutes'"}
      where id = $1 and quote_id = $2 and (status = 'offered' or (status = 'held' and hold_expires_at < now()))
      returning id`,
    [slotId, quote.id],
  );
  if (!held) return { error: q.slotTaken };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.query(`update quotes set accepted_at = now(), accepted_ip = $2 where id = $1`, [quote.id, ip]);

  if (direct) {
    // No card payments yet: the client asks to book in the chat; the artist confirms once the money arrives.
    const ct = dict(locale).chat.direct;
    const body = fill(ct.request, { amount: money(quote.deposit_cents, quote.currency, locale), artist: quote.artist_name });
    const b = await db.one<{ id: string; studio_id: string; client: string }>(`select b.id, b.studio_id, c.name as client from briefs b join clients c on c.id = b.client_id where b.chat_token = $1`, [quote.chat_token]);
    if (b) {
      await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'message', 'client', $3, $4)`, [b.studio_id, b.id, body, JSON.stringify({ direct: quote.id })]);
      const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [b.studio_id]);
      after(() => notifyEach(members, (l) => ({ title: fill(dict(l).chat.direct.pushTitle, { name: b.client }), body: money(quote.deposit_cents, quote.currency, l), url: `/studio/chats/${b.id}`, tag: `direct:${b.id}` })));
      await emailChat(db, b.id, "artist", "bookRequest", body);
    }
    redirect(`/c/${quote.chat_token}${back}`);
  }

  if (!live.payments) {
    // Demo mode: the deposit is simulated and the booking confirms immediately.
    await confirmBooking(db, {
      quoteId: quote.id,
      slotId,
      provider: "demo",
      checkoutId: `demo_${randomUUID()}`,
      amountCents: quote.deposit_cents,
      currency: quote.currency,
    });
    after(async () => {
      await flushOutbox(await getDb());
    });
    redirect(`/q/${token}${back}`);
  }

  const checkout = await createDepositCheckout({
    accountId: quote.stripe_account_id!,
    amountCents: quote.deposit_cents,
    currency: quote.currency,
    description: `${quote.artist_name}: ${placementLabel(quote.placement, locale)}`,
    customerEmail: quote.client_email,
    quoteId: quote.id,
    slotId,
    studioId: quote.studio_id,
    successUrl: `${env.appUrl}/q/${token}?checkout=success`,
    cancelUrl: `${env.appUrl}/q/${token}?checkout=cancelled`,
    locale,
    feeBps: feeBpsFor(quote.plan, { basic: env.platformFeeBps, full: env.platformFeeFullBps }),
  });
  await db.query(
    `insert into payments (studio_id, quote_id, provider, checkout_id, amount_cents, application_fee_cents, currency, status)
     values ($1, $2, 'stripe', $3, $4, $5, $6, 'pending') on conflict (checkout_id) do nothing`,
    [quote.studio_id, quote.id, checkout.id, quote.deposit_cents, checkout.fee, quote.currency],
  );
  redirect(checkout.url);
}
