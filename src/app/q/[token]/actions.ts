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
import { env, live } from "@/lib/env";
import { createDepositCheckout } from "@/lib/payments";
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
  if (quote.status === "paid") redirect(`/q/${token}`);
  if (new Date(quote.expires_at).getTime() < Date.now()) return { error: q.expired };
  if (form.get("agree") !== "on") return { error: q.agreeRequired };
  const slotId = String(form.get("slot") ?? "");
  if (!quote.slots.some((s) => s.id === slotId)) return { error: q.dateRequired };
  if (live.payments && (!quote.stripe_account_id || !quote.stripe_charges_enabled)) return { error: fill(q.paymentsOff, { artist: quote.artist_name }) };

  const db = await getDb();
  // Hold the date for 30 minutes while the client pays; an expired hold is free again.
  const held = await db.one(
    `update quote_slots set status = 'held', hold_expires_at = now() + interval '31 minutes'
      where id = $1 and quote_id = $2 and (status = 'offered' or (status = 'held' and hold_expires_at < now()))
      returning id`,
    [slotId, quote.id],
  );
  if (!held) return { error: q.slotTaken };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.query(`update quotes set accepted_at = now(), accepted_ip = $2 where id = $1`, [quote.id, ip]);

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
    redirect(`/q/${token}`);
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
  });
  await db.query(
    `insert into payments (studio_id, quote_id, provider, checkout_id, amount_cents, application_fee_cents, currency, status)
     values ($1, $2, 'stripe', $3, $4, $5, $6, 'pending') on conflict (checkout_id) do nothing`,
    [quote.studio_id, quote.id, checkout.id, quote.deposit_cents, checkout.fee, quote.currency],
  );
  redirect(checkout.url);
}
