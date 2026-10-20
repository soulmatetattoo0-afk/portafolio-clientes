import Stripe from "stripe";

import { env, live } from "./env";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("Stripe is not configured");
  client ??= new Stripe(env.stripeSecretKey, { appInfo: { name: "Vanta" } });
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
  /** The date a deposit books; a balance has none. */
  slotId?: string;
  studioId: string;
  /** What the money is for: the deposit that books the date, or the rest of the tattoo on the day. */
  kind?: "deposit" | "balance";
  appointmentId?: string;
  successUrl: string;
  cancelUrl: string;
  locale: "en" | "es";
  /** Platform fee for this artist's plan; defaults to the global setting. */
  feeBps?: number;
}

/** A Checkout Session charged directly on the artist's account; the artist is the merchant and VANTA keeps its fee. */
export async function createDepositCheckout(d: DepositCheckout) {
  const fee = Math.floor((d.amountCents * (d.feeBps ?? env.platformFeeBps)) / 10_000);
  const metadata = { quote_id: d.quoteId, slot_id: d.slotId ?? "", studio_id: d.studioId, kind: d.kind ?? "deposit", appointment_id: d.appointmentId ?? "" };
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
        metadata,
      },
      metadata,
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

/** VANTA Full: $20 a month, the first month at half price for artists who just launched. */
export const FULL_PRICE_CENTS = 2000;
const LAUNCH_COUPON = "vanta-launch-50";

/** Checkout for the artist's own subscription, on VANTA's account (not the artist's). */
export async function createSubscriptionCheckout(d: { studioId: string; email: string; customerId: string | null; successUrl: string; cancelUrl: string; locale: "en" | "es"; launchOffer: boolean }) {
  const s = stripe();
  if (d.launchOffer) {
    // The coupon is made once and reused: half off, the first invoice only.
    await s.coupons.retrieve(LAUNCH_COUPON).catch(() => s.coupons.create({ id: LAUNCH_COUPON, percent_off: 50, duration: "once", name: "VANTA launch: first month 50% off" }));
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    locale: d.locale,
    ...(d.customerId ? { customer: d.customerId } : { customer_email: d.email }),
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: FULL_PRICE_CENTS, recurring: { interval: "month" }, product_data: { name: "VANTA Full" } },
      },
    ],
    ...(d.launchOffer ? { discounts: [{ coupon: LAUNCH_COUPON }] } : {}),
    metadata: { studio_id: d.studioId },
    subscription_data: { metadata: { studio_id: d.studioId } },
    success_url: d.successUrl,
    cancel_url: d.cancelUrl,
  });
  return { url: session.url! };
}

export function verifyBillingWebhook(rawBody: string, signature: string | null) {
  if (!env.stripeBillingWebhookSecret || !signature) throw new Error("Missing billing webhook secret or signature");
  return stripe().webhooks.constructEvent(rawBody, signature, env.stripeBillingWebhookSecret);
}
