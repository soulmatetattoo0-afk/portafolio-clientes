/**
 * The signed-in client: the person looking for an artist. Separate from
 * studio members (an artist can be both). Every query here scopes by the
 * user's id; the row policies in 0007 are the second wall.
 */
import { redirect } from "next/navigation";

import { getDb } from "./db";
import { getSession, type Session } from "./auth";
import { CARD_COLS, CARD_JOINS, CARD_SQL, toCard, type ArtistCard, type BriefStatus, type CardRow } from "./queries";
import { fileUrl } from "./storage";

export interface ClientUser {
  userId: string;
  email: string;
  name: string | null;
  locale: "en" | "es";
  homeCity: string | null;
  citySlug: string | null;
  alerts: { spots: boolean; books_open: boolean; issue: boolean; new_work: boolean };
}

export async function getClientUser(session?: Session | null): Promise<ClientUser | null> {
  const s = session ?? (await getSession());
  if (!s) return null;
  const db = await getDb();
  const row = await db.one<{ user_id: string; email: string; name: string | null; locale: "en" | "es"; home_city: string | null; city_slug: string | null; alerts: ClientUser["alerts"] }>(
    `select user_id, email, name, locale, home_city, city_slug, alerts from client_users where user_id = $1`,
    [s.userId],
  );
  if (!row) return null;
  return { userId: row.user_id, email: row.email, name: row.name, locale: row.locale, homeCity: row.home_city, citySlug: row.city_slug, alerts: row.alerts };
}

/** Gate for every client page and action: signed in as a client, else to sign-in with a way back. */
export async function requireClient(next?: string): Promise<ClientUser> {
  const me = await getClientUser();
  if (!me) redirect(`/me/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return me;
}

/**
 * First sign-in: create the client row and claim the studios' client records
 * made with this email (briefs, quotes and appointments follow them).
 */
export async function ensureClientUser(userId: string, email: string, locale: "en" | "es" = "en"): Promise<void> {
  const db = await getDb();
  await db.query(
    `insert into client_users (user_id, email, locale) values ($1, $2, $3)
       on conflict (user_id) do update set email = excluded.email`,
    [userId, email, locale],
  );
  await db.query(`update clients set user_id = $1 where lower(email) = lower($2) and user_id is null`, [userId, email]);
}

export async function followedIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ artist_id: string }>(`select artist_id from follows where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.artist_id));
}

export async function isFollowing(userId: string, artistId: string): Promise<boolean> {
  const db = await getDb();
  return Boolean(await db.one(`select 1 from follows where user_id = $1 and artist_id = $2`, [userId, artistId]));
}

export async function savedIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ portfolio_item_id: string }>(`select portfolio_item_id from saves where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.portfolio_item_id));
}

export async function followedCities(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.query<{ city_slug: string }>(`select city_slug from city_follows where user_id = $1`, [userId]);
  return new Set(rows.map((r) => r.city_slug));
}

/** A `next` from the URL that is safe to redirect to: same-site path only. */
export function safeNext(next: unknown, fallback = "/me"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !/[\s\\]/.test(next) ? next : fallback;
}

/** The contact details the person last gave a studio, to prefill the brief wizard. */
export async function getMyContact(userId: string): Promise<{ name: string; email: string; phone: string | null; instagram: string | null } | null> {
  const db = await getDb();
  return db.one(`select name, email, phone, instagram from clients where user_id = $1 order by created_at desc limit 1`, [userId]);
}

/** Whether a brief belongs to one of the person's client records. */
export async function ownsBrief(userId: string, briefId: string): Promise<boolean> {
  const db = await getDb();
  return Boolean(await db.one(`select 1 from briefs b join clients c on c.id = b.client_id where b.id = $1 and c.user_id = $2`, [briefId, userId]));
}

/* ------------------------------------------------------------------ briefs */

export interface MyBriefItem {
  id: string;
  ref: string;
  status: BriefStatus;
  created_at: Date;
  placement: string;
  full_coverage: boolean;
  style: string;
  artist_name: string;
  artist_slug: string;
  artist_accent: string | null;
  artist_portrait_url: string | null;
  quote: { token: string; status: string; deposit_cents: number; currency: string; expires_at: Date } | null;
}

type MyBriefRow = Omit<MyBriefItem, "artist_portrait_url" | "quote"> & {
  artist_portrait_path: string | null;
  q_token: string | null; q_status: string | null; q_deposit_cents: number | null; q_currency: string | null; q_expires_at: Date | null;
};

const MY_BRIEF_COLS = `b.id, b.ref, b.status, b.created_at, b.placement, b.full_coverage, b.style,
  a.display_name as artist_name, a.slug as artist_slug, a.accent as artist_accent, a.portrait_path as artist_portrait_path,
  q.token as q_token, q.status as q_status, q.deposit_cents as q_deposit_cents, q.currency as q_currency, q.expires_at as q_expires_at`;
const MY_BRIEF_FROM = `from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id
  left join lateral (select token, status, deposit_cents, currency, expires_at from quotes where brief_id = b.id order by created_at desc limit 1) q on true`;

async function toMyBrief(r: MyBriefRow): Promise<MyBriefItem> {
  const { artist_portrait_path, q_token, q_status, q_deposit_cents, q_currency, q_expires_at, ...b } = r;
  return {
    ...b,
    artist_portrait_url: artist_portrait_path ? await fileUrl("public", artist_portrait_path) : null,
    quote: q_token ? { token: q_token, status: q_status!, deposit_cents: q_deposit_cents!, currency: q_currency!, expires_at: q_expires_at! } : null,
  };
}

export async function listMyBriefs(userId: string): Promise<MyBriefItem[]> {
  const db = await getDb();
  const rows = await db.query<MyBriefRow>(`select ${MY_BRIEF_COLS} ${MY_BRIEF_FROM} where c.user_id = $1 order by b.created_at desc limit 100`, [userId]);
  return Promise.all(rows.map(toMyBrief));
}

export interface MyBriefDetail extends MyBriefItem {
  color_mode: string;
  size_w_cm: number | null;
  size_h_cm: number | null;
  description: string;
  avoid: string | null;
  is_coverup: boolean;
  is_first_tattoo: boolean;
  timing: "asap" | "flexible" | "specific";
  preferred_dates: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  currency: string;
  city: string | null;
  flash_title: string | null;
  files: { id: string; kind: "reference" | "skin" | "placement"; url: string }[];
  events: { id: string; kind: string; actor: string; body: string | null; created_at: Date }[];
  quoteDetail: { price_min_cents: number; price_max_cents: number | null; sessions: number; message: string | null; paid: boolean } | null;
}

export async function getMyBrief(userId: string, briefId: string): Promise<MyBriefDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(briefId)) return null;
  const db = await getDb();
  const row = await db.one<MyBriefRow & Omit<MyBriefDetail, keyof MyBriefItem | "files" | "events" | "quoteDetail">>(
    `select ${MY_BRIEF_COLS}, b.color_mode, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm, b.description, b.avoid, b.is_coverup, b.is_first_tattoo,
            b.timing, b.preferred_dates, b.budget_min_cents, b.budget_max_cents, b.currency, t.city, f.title as flash_title
       ${MY_BRIEF_FROM} left join tour_stops t on t.id = b.tour_stop_id left join flash_designs f on f.id = b.flash_id
      where c.user_id = $1 and b.id = $2`,
    [userId, briefId],
  );
  if (!row) return null;
  const base = await toMyBrief(row);
  const [files, events, quoteDetail] = await Promise.all([
    db.query<{ id: string; kind: "reference" | "skin" | "placement"; path: string }>(`select id, kind, path from brief_files where brief_id = $1 order by created_at`, [briefId]),
    db.query<MyBriefDetail["events"][number]>(`select id, kind, actor, body, created_at from brief_events where brief_id = $1 and kind <> 'note' order by created_at`, [briefId]),
    db.one<MyBriefDetail["quoteDetail"]>(
      `select q.price_min_cents, q.price_max_cents, q.sessions, q.message, (q.status = 'paid') as paid from quotes q where q.brief_id = $1 order by q.created_at desc limit 1`,
      [briefId],
    ),
  ]);
  return {
    ...base,
    color_mode: row.color_mode, size_w_cm: row.size_w_cm, size_h_cm: row.size_h_cm, description: row.description, avoid: row.avoid,
    is_coverup: row.is_coverup, is_first_tattoo: row.is_first_tattoo, timing: row.timing, preferred_dates: row.preferred_dates,
    budget_min_cents: row.budget_min_cents, budget_max_cents: row.budget_max_cents, currency: row.currency, city: row.city, flash_title: row.flash_title,
    files: await Promise.all(files.map(async (f) => ({ id: f.id, kind: f.kind, url: await fileUrl("private", f.path) }))),
    events,
    quoteDetail,
  };
}

/* ------------------------------------------------------------------ quotes & appointments */

export interface MyOpenQuote {
  token: string;
  status: string;
  deposit_cents: number;
  currency: string;
  expires_at: Date;
  brief_id: string;
  ref: string;
  placement: string;
  artist_name: string;
  artist_slug: string;
  artist_accent: string | null;
}

/** Quotes the person can still pay: sent or viewed, not past their date. */
export async function listOpenQuotes(userId: string): Promise<MyOpenQuote[]> {
  const db = await getDb();
  return db.query<MyOpenQuote>(
    `select q.token, q.status, q.deposit_cents, q.currency, q.expires_at, b.id as brief_id, b.ref, b.placement,
            a.display_name as artist_name, a.slug as artist_slug, a.accent as artist_accent
       from quotes q join briefs b on b.id = q.brief_id join clients c on c.id = b.client_id join artists a on a.id = q.artist_id
      where c.user_id = $1 and q.status in ('sent', 'viewed') and q.expires_at > now()
      order by q.expires_at`,
    [userId],
  );
}

export interface MyAppointment {
  id: string;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  city: string | null;
  studio_name: string | null;
  address: string | null;
  status: "confirmed" | "completed" | "no_show" | "cancelled";
  placement: string | null;
  brief_id: string | null;
  quote_token: string | null;
  artist_name: string;
  artist_slug: string;
  artist_accent: string | null;
}

export async function listMyAppointments(userId: string): Promise<{ upcoming: MyAppointment[]; past: MyAppointment[] }> {
  const db = await getDb();
  const rows = await db.query<MyAppointment>(
    `select ap.id, ap.starts_at, ap.ends_at, ap.timezone, coalesce(t.city, ap.city) as city, t.studio_name, t.address, ap.status, b.placement, ap.brief_id,
            q.token as quote_token, a.display_name as artist_name, a.slug as artist_slug, a.accent as artist_accent
       from appointments ap join clients c on c.id = ap.client_id join artists a on a.id = ap.artist_id
       left join briefs b on b.id = ap.brief_id left join quotes q on q.id = ap.quote_id
       left join quote_slots s on s.id = ap.slot_id left join tour_stops t on t.id = s.tour_stop_id
      where c.user_id = $1 and ap.status <> 'cancelled' order by ap.starts_at`,
    [userId],
  );
  const now = Date.now();
  return {
    upcoming: rows.filter((r) => new Date(r.ends_at).getTime() >= now && r.status === "confirmed"),
    past: rows.filter((r) => new Date(r.ends_at).getTime() < now || r.status !== "confirmed").reverse(),
  };
}

/* ------------------------------------------------------------------ follows & saves */

export async function listFollowed(userId: string): Promise<ArtistCard[]> {
  const db = await getDb();
  const rows = await db.query<CardRow>(
    `${CARD_SQL} select ${CARD_COLS}, fo.created_at as followed_at from follows fo join artists a on a.id = fo.artist_id ${CARD_JOINS}
      where fo.user_id = $1 order by fo.created_at desc`,
    [userId],
  );
  return Promise.all(rows.map(toCard));
}

export interface SavedPiece {
  id: string;
  title: string | null;
  style: string | null;
  color_mode: "black_grey" | "color" | null;
  placement: string | null;
  url: string | null;
  artist_name: string;
  artist_slug: string;
  artist_accent: string | null;
}

export async function listSaved(userId: string): Promise<SavedPiece[]> {
  const db = await getDb();
  const rows = await db.query<Omit<SavedPiece, "url"> & { image_path: string | null }>(
    `select p.id, p.title, p.style, p.color_mode, p.placement, p.image_path, a.display_name as artist_name, a.slug as artist_slug, a.accent as artist_accent
       from saves s join portfolio_items p on p.id = s.portfolio_item_id join artists a on a.id = p.artist_id
      where s.user_id = $1 and p.published order by s.created_at desc`,
    [userId],
  );
  return Promise.all(rows.map(async ({ image_path, ...p }) => ({ ...p, url: image_path ? await fileUrl("public", image_path) : null })));
}

export interface FollowedSpot {
  id: string;
  city: string;
  city_slug: string | null;
  country: string;
  studio_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: "announced" | "booking";
  artist_name: string;
  artist_slug: string;
  artist_accent: string | null;
}

/** Upcoming guest spots (not home) of the artists the person follows, within `days`. */
export async function followedSpots(userId: string, days = 120): Promise<FollowedSpot[]> {
  const db = await getDb();
  const rows = await db.query<FollowedSpot & { starts_on: unknown; ends_on: unknown }>(
    `select t.id, t.city, t.city_slug, t.country, t.studio_name, t.starts_on, t.ends_on, t.status,
            a.display_name as artist_name, a.slug as artist_slug, a.accent as artist_accent
       from follows fo join artists a on a.id = fo.artist_id join tour_stops t on t.artist_id = a.id
      where fo.user_id = $1 and not t.is_home and t.status in ('announced', 'booking')
        and (t.ends_on is null or t.ends_on >= current_date) and (t.starts_on is null or t.starts_on <= current_date + $2::int)
      order by t.starts_on nulls last limit 20`,
    [userId, days],
  );
  const iso = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
  return rows.map((r) => ({ ...r, starts_on: iso(r.starts_on), ends_on: iso(r.ends_on) }));
}
