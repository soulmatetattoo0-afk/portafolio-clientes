import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { Db } from "./db";
import { env } from "./env";

/**
 * Mercado Pago, for artists in Chile. Each artist links their own Mercado Pago
 * account to VANTA's application (OAuth); a deposit is a Checkout Pro
 * preference created with the artist's token, so the artist is the merchant
 * and Mercado Pago splits the payment: its own fee first, then VANTA's
 * marketplace fee, the rest to the artist. VANTA's Pro subscription is a
 * preapproval charged to VANTA's own account.
 *
 * Amounts in the app are ×100 (CLP too); Mercado Pago takes whole pesos.
 */


/* ---------------------------------------------------------------- tokens at rest */

const key = () => createHash("sha256").update(`${env.appSecret}:mercadopago`).digest();

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function unseal(sealed: string): string {
  const raw = Buffer.from(sealed, "base64url");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/* ---------------------------------------------------------------- linking an artist */

export const redirectUri = () => `${env.appUrl}/api/mp/callback`;

/** Where the artist authorises VANTA on Mercado Pago; `state` comes back signed to the callback. */
export function authUrl(state: string) {
  const q = new URLSearchParams({ client_id: env.mpClientId!, response_type: "code", platform_id: "mp", state, redirect_uri: redirectUri() });
  return `https://auth.mercadopago.cl/authorization?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_in: number;
}

async function oauth(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${env.mpApiBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: env.mpClientId, client_secret: env.mpClientSecret, ...body }),
  });
  if (!res.ok) throw new Error(`mp oauth ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function store(db: Db, artistId: string, t: TokenResponse) {
  await db.query(
    `update artists set mp_user_id = $2, mp_access_token = $3, mp_refresh_token = $4, mp_token_expires_at = now() + make_interval(secs => $5) where id = $1`,
    [artistId, String(t.user_id), seal(t.access_token), seal(t.refresh_token), t.expires_in],
  );
}

/** Back from Mercado Pago with a code: trade it for the artist's tokens and keep them sealed. */
export async function linkArtist(db: Db, artistId: string, code: string) {
  await store(db, artistId, await oauth({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }));
}

/** The artist's access token, renewed when it has less than a week left (they last 180 days). */
export async function artistToken(db: Db, artistId: string): Promise<string | null> {
  const row = await db.one<{ access: string | null; refresh: string | null; soon: boolean }>(
    `select mp_access_token as access, mp_refresh_token as refresh, coalesce(mp_token_expires_at < now() + interval '7 days', true) as soon from artists where id = $1`,
    [artistId],
  );
  if (!row?.access) return null;
  if (row.soon && row.refresh) {
    try {
      const t = await oauth({ grant_type: "refresh_token", refresh_token: unseal(row.refresh) });
      await store(db, artistId, t);
      return t.access_token;
    } catch (e) {
      console.error("mp token refresh failed", artistId, e);
    }
  }
  return unseal(row.access);
}

export async function unlinkArtist(db: Db, artistId: string) {
  await db.query(`update artists set mp_user_id = null, mp_access_token = null, mp_refresh_token = null, mp_token_expires_at = null where id = $1`, [artistId]);
}

/* ---------------------------------------------------------------- fees */

const whole = (cents: number) => Math.round(cents / 100);

/**
 * The client's service fee on a deposit (×100 units): a share of it with a
 * floor, in whole pesos. No ceiling by default: above one, Mercado Pago's own
 * fee on a large deposit would outgrow it and come off the artist.
 */
export function serviceFee(depositCents: number) {
  const raw = Math.max(env.serviceFeeMinCents, Math.round((depositCents * env.serviceFeeBps) / 10_000));
  const capped = env.serviceFeeMaxCents > 0 ? Math.min(env.serviceFeeMaxCents, raw) : raw;
  return Math.round(capped / 100) * 100;
}

/**
 * VANTA's marketplace fee, whole pesos: the service fee less what Mercado Pago
 * keeps of the whole payment, so the artist receives the deposit in full.
 */
export function marketplaceFee(totalCents: number, serviceCents: number) {
  return Math.max(0, whole(serviceCents) - Math.ceil((whole(totalCents) * env.mpFeeBps) / 10_000));
}

/* ---------------------------------------------------------------- payments */

async function call<T>(token: string, path: string, init: { method?: string; body?: unknown; idempotency?: string } = {}): Promise<T> {
  const res = await fetch(`${env.mpApiBase}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.idempotency ? { "x-idempotency-key": init.idempotency } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`mp ${init.method ?? "GET"} ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * What a payment is for, written into the preference and read back from the
 * payment. `key` names our own payments row (checkout_id `mp:<key>`), made
 * before the client leaves for Mercado Pago.
 */
export type Ref = { kind: "deposit"; quoteId: string; slotId: string; key: string } | { kind: "balance"; appointmentId: string; key: string };
export const writeRef = (r: Ref) => (r.kind === "deposit" ? `dep:${r.quoteId}:${r.slotId}:${r.key}` : `bal:${r.appointmentId}:${r.key}`);
export function readRef(s: string | null | undefined): Ref | null {
  const [k, a, b, c] = (s ?? "").split(":");
  if (k === "dep" && a && b && c) return { kind: "deposit", quoteId: a, slotId: b, key: c };
  if (k === "bal" && a && b) return { kind: "balance", appointmentId: a, key: b };
  return null;
}
export const checkoutIdOf = (r: Ref) => `mp:${r.key}`;

export interface Preference {
  token: string;
  artistId: string;
  title: string;
  /** Everything the client pays, ×100. */
  totalCents: number;
  /** VANTA's share, whole pesos. */
  marketplaceFee: number;
  payerEmail: string;
  ref: Ref;
  successUrl: string;
  failureUrl: string;
}

/** A Checkout Pro preference on the artist's account; the client is sent to `url`. It lapses with the 30-minute hold on the date. */
export async function createPreference(p: Preference) {
  const now = Date.now();
  const pref = await call<{ id: string; init_point: string }>(p.token, "/checkout/preferences", {
    method: "POST",
    idempotency: randomUUID(),
    body: {
      items: [{ id: p.ref.kind, title: p.title.slice(0, 250), quantity: 1, unit_price: whole(p.totalCents), currency_id: "CLP" }],
      payer: { email: p.payerEmail || undefined },
      marketplace_fee: p.marketplaceFee,
      external_reference: writeRef(p.ref),
      notification_url: `${env.appUrl}/api/mp/webhook?a=${p.artistId}`,
      back_urls: { success: p.successUrl, pending: p.successUrl, failure: p.failureUrl },
      auto_return: "approved",
      statement_descriptor: "VANTA",
      expires: true,
      expiration_date_from: new Date(now - 60_000).toISOString(),
      expiration_date_to: new Date(now + 30 * 60_000).toISOString(),
    },
  });
  return { id: pref.id, url: pref.init_point };
}

export interface MpPayment {
  id: number;
  status: "approved" | "pending" | "in_process" | "authorized" | "rejected" | "cancelled" | "refunded" | "charged_back";
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  order?: { id?: string | number } | null;
}

export const getPayment = (token: string, id: string) => call<MpPayment>(token, `/v1/payments/${encodeURIComponent(id)}`);

/** Give the client everything back; Mercado Pago returns VANTA's share and the artist's in proportion. */
export const refundPayment = (token: string, paymentId: string) => call<{ id: number }>(token, `/v1/payments/${encodeURIComponent(paymentId)}/refunds`, { method: "POST", body: {}, idempotency: `refund-${paymentId}` });

/**
 * Mercado Pago signs each notification: `x-signature: ts=…,v1=…` over
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Without a secret set the
 * check is skipped: every notification is re-read from the API anyway.
 */
export function verifyNotification(headers: Headers, dataId: string | null) {
  if (!env.mpWebhookSecret) return true;
  const sig = headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((kv) => kv.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `${id ? `id:${id};` : ""}${headers.get("x-request-id") ? `request-id:${headers.get("x-request-id")};` : ""}ts:${parts.ts};`;
  const want = createHmac("sha256", env.mpWebhookSecret).update(manifest).digest();
  const got = Buffer.from(parts.v1, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ---------------------------------------------------------------- VANTA Pro */

export interface MpPreapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  external_reference: string | null;
  init_point?: string;
}

/** A monthly subscription to VANTA Pro, charged to VANTA's account; the artist approves it on Mercado Pago. */
export async function createSubscription(a: { studioId: string; email: string; backUrl: string }) {
  if (!env.mpAccessToken) throw new Error("Mercado Pago subscriptions are not configured");
  return call<MpPreapproval>(env.mpAccessToken, "/preapproval", {
    method: "POST",
    idempotency: randomUUID(),
    body: {
      reason: "VANTA Pro",
      external_reference: a.studioId,
      payer_email: a.email,
      back_url: a.backUrl,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: env.proPriceClp, currency_id: "CLP" },
      status: "pending",
    },
  });
}

export const getSubscription = (id: string) => call<MpPreapproval>(env.mpAccessToken!, `/preapproval/${encodeURIComponent(id)}`);
export const cancelSubscription = (id: string) => call<MpPreapproval>(env.mpAccessToken!, `/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "cancelled" } });
