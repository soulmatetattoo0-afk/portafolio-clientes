/**
 * Which services are live. Every integration has a local stand-in so the whole
 * product runs on a laptop with zero accounts: an embedded Postgres, a demo
 * login, files on disk, simulated deposits and an email log.
 */

const read = (name: string) => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

export const env = {
  // On Vercel the deployment's own host stands in for APP_URL (emails, Stripe redirects, cookie security).
  appUrl: (read("APP_URL") ?? (read("VERCEL_PROJECT_PRODUCTION_URL") ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}` : read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : "http://localhost:3000")).replace(/\/$/, ""),
  appSecret: read("APP_SECRET") ?? "local-dev-secret-change-me",
  databaseUrl: read("DATABASE_URL"),
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey: read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  /** The second endpoint, for VANTA's own account: the artists' subscriptions. */
  stripeBillingWebhookSecret: read("STRIPE_BILLING_WEBHOOK_SECRET"),
  /** Platform fee on deposits, in basis points (300 = 3%). 0 while on subscriptions. */
  /** VANTA's share of every payment made in the app (deposit and balance), in basis points: Basic, then Full. */
  platformFeeBps: Number(read("PLATFORM_FEE_BPS") ?? "500"),
  platformFeeFullBps: Number(read("PLATFORM_FEE_FULL_BPS") ?? "300"),
  resendApiKey: read("RESEND_API_KEY"),
  /** Until VANTA has its own domain: mail goes out through a Gmail account with an app password. */
  smtpUser: read("SMTP_USER"),
  smtpPass: read("SMTP_PASS"),
  emailFrom: read("EMAIL_FROM") ?? (read("SMTP_USER") ? `VANTA <${read("SMTP_USER")}>` : "Vanta <bookings@example.com>"),
  /** Comma-separated emails that may open the editor's desk (/admin). Local mode: the demo member. */
  adminEmails: (read("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  cronSecret: read("CRON_SECRET"),
  /** Web push (notifications with the app closed). Local mode makes its own pair in .data. */
  vapidPublicKey: read("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  vapidPrivateKey: read("VAPID_PRIVATE_KEY"),
  vapidSubject: read("VAPID_SUBJECT") ?? "mailto:hello@vanta.app",
  /** Comma-separated emails allowed to create an artist page. Empty = open signup. */
  allowedSignups: (read("ALLOWED_SIGNUPS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

export const live = {
  db: Boolean(env.databaseUrl),
  auth: Boolean(env.supabaseUrl && env.supabaseAnonKey),
  storage: Boolean(env.supabaseUrl && env.supabaseServiceKey),
  payments: Boolean(env.stripeSecretKey),
  email: Boolean(env.resendApiKey || (env.smtpUser && env.smtpPass)),
};

/** The member that local mode signs in as (seeded with the demo studio). */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
/** The client that local mode can sign in as (Daniel Reyes in the seed). */
export const DEMO_CLIENT_USER_ID = "00000000-0000-4000-8000-000000000002";
/** The demo member's address; also the local admin. */
export const DEMO_EMAIL = "demo@vanta.local";
export const DEMO_CLIENT_EMAIL = "daniel@example.com";
/** TATTOO BY SOVA, the first artist account; local mode can sign in as her too. */
export const SOVA_USER_ID = "00000000-0000-4000-8000-000000000003";
export const SOVA_EMAIL = "tattoo.by.sova@gmail.com";

/**
 * The demo: the embedded database (laptops, previews without a database) or a
 * deployment that asks for it with VANTA_DEMO=1. Only here do the scripted
 * moments run (the client who books by themself, the canned replies, the
 * seeded studio) and payments are simulated. Never in production.
 */
export const demoMode = !live.db || read("VANTA_DEMO") === "1";
/** A real deployment without Stripe yet: the client pays the artist directly and the artist confirms it in the app. */
export const manualPayments = !demoMode && !live.payments;
/** For one artist: direct payments until their own Stripe account can take cards (and always while VANTA has no Stripe). */
export const paysDirect = (chargesEnabled: boolean) => !demoMode && (!live.payments || !chargesEnabled);
