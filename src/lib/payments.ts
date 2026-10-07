import Stripe from "stripe";

import { env, live } from "./env";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("Stripe is not configured");
  client ??= new Stripe(env.stripeSecretKey, { appInfo: { name: "Brief" } });
  return client;
}

/** Create (once) and return the artist's Stripe account plus an onboarding link. */
export async function connectLink(args: { accountId: string | null; email: string; returnPath: string }) {
  const s = stripe();
  const accountId =
    args.accountId ??
    (
      await s.accounts.create({
        // Standard accounts: the artist owns the Stripe account, sees every payment and handles disputes.
        type: "standard",
        email: args.email,
      })
    ).id;
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}${args.returnPath}?stripe=refresh`,
    return_url: `${env.appUrl}${args.returnPath}?stripe=return`,
  });
  return { accountId, url: link.url };
}

export async function accountReady(accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  return Boolean(account.charges_enabled);
}

export interface DepositCheckout {
  accountId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  quoteId: string;
  slotId: string;
  studioId: string;
  successUrl: string;
  cancelUrl: string;
  locale: "en" | "es";
}

/** A Checkout Session charged directly on the artist's account; the artist is the merchant. */
export async function createDepositCheckout(d: DepositCheckout) {
  const fee = Math.floor((d.amountCents * env.platformFeeBps) / 10_000);
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: d.locale,
      customer_email: d.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: d.currency,
            unit_amount: d.amountCents,
            product_data: { name: d.description },
          },
        },
      ],
      payment_intent_data: {
        ...(fee > 0 ? { application_fee_amount: fee } : {}),
        metadata: { quote_id: d.quoteId, slot_id: d.slotId, studio_id: d.studioId },
      },
      metadata: { quote_id: d.quoteId, slot_id: d.slotId, studio_id: d.studioId },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: d.successUrl,
      cancel_url: d.cancelUrl,
    },
    { stripeAccount: d.accountId },
  );
  return { id: session.id, url: session.url!, fee };
}

export function verifyWebhook(rawBody: string, signature: string | null) {
  if (!env.stripeWebhookSecret || !signature) throw new Error("Missing webhook secret or signature");
  return stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}

export const paymentsLive = () => live.payments;
