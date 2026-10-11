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
  /** Platform fee on deposits, in basis points (300 = 3%). 0 while on subscriptions. */
  platformFeeBps: Number(read("PLATFORM_FEE_BPS") ?? "0"),
  resendApiKey: read("RESEND_API_KEY"),
  emailFrom: read("EMAIL_FROM") ?? "Vanta <bookings@example.com>",
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
  email: Boolean(env.resendApiKey),
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
export const SOVA_EMAIL = "sova@vanta.local";

/** True when anything runs on a local stand-in; the UI labels demo behaviour. */
export const demoMode = !live.db || !live.auth || !live.payments;
