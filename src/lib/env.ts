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
  appUrl: (read("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
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
  emailFrom: read("EMAIL_FROM") ?? "Brief <bookings@example.com>",
  cronSecret: read("CRON_SECRET"),
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

/** True when anything runs on a local stand-in; the UI labels demo behaviour. */
export const demoMode = !live.db || !live.auth || !live.payments;
