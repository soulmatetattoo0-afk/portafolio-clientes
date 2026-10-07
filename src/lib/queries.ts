import { getDb } from "./db";
import { fileUrl } from "./storage";

export interface DepositPolicy {
  refundable: boolean;
  reschedule_notice_hours: number;
  reschedules_allowed: number;
  applies_to_final_price: boolean;
}

export interface Artist {
  id: string;
  studio_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  instagram: string | null;
  home_city: string | null;
  styles: string[];
  accepting: boolean;
  min_price_cents: number | null;
  currency: string;
  deposit_policy: DepositPolicy;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  /** Poster cover: the giant word behind the photo, a short quote, the year they started. */
  cover_word: string | null;
  cover_quote: string | null;
  since_year: number | null;
  /** Per-artist accent colour (#rrggbb) for the public experience. */
  accent: string | null;
  /** The photo is a finished poster: show it whole, write nothing over it. */
  cover_poster: boolean;
  portrait_url: string | null;
}

export interface TourStop {
  id: string;
  city: string;
  country: string;
  studio_name: string | null;
  address: string | null;
  timezone: string;
  starts_on: string | null;
  ends_on: string | null;
  is_home: boolean;
  status: "announced" | "booking" | "full" | "done";
  waitlist_count?: number;
}

export interface FlashItem {
  id: string;
  title: string;
  description: string | null;
  size_label: string | null;
  price_cents: number | null;
  currency: string;
  status: "available" | "reserved" | "taken";
  repeatable: boolean;
  published: boolean;
  url: string | null;
}

export interface PortfolioItem {
  id: string;
  title: string | null;
  style: string | null;
  color_mode: "black_grey" | "color" | null;
  placement: string | null;
  is_healed: boolean;
  published: boolean;
  url: string | null;
}

const ARTIST_COLS = `a.id, a.studio_id, a.slug, a.display_name, a.headline, a.bio, a.instagram, a.home_city, a.styles, a.accepting,
  a.min_price_cents, a.currency, a.deposit_policy, a.stripe_account_id, a.stripe_charges_enabled,
  a.cover_word, a.cover_quote, a.since_year, a.accent, a.cover_poster, a.portrait_path`;

type ArtistRow = Omit<Artist, "portrait_url"> & { portrait_path: string | null };

async function withPortrait(row: ArtistRow | null): Promise<Artist | null> {
  if (!row) return null;
  const { portrait_path, ...a } = row;
  return { ...a, portrait_url: portrait_path ? await fileUrl("public", portrait_path) : null };
}

const isoDate = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

function normStop(r: TourStop): TourStop {
  return { ...r, starts_on: isoDate(r.starts_on), ends_on: isoDate(r.ends_on), waitlist_count: r.waitlist_count == null ? undefined : Number(r.waitlist_count) };
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const db = await getDb();
  return withPortrait(await db.one<ArtistRow>(`select ${ARTIST_COLS} from artists a where a.slug = $1`, [slug.toLowerCase()]));
}

export async function getArtistById(id: string): Promise<Artist | null> {
  const db = await getDb();
  return withPortrait(await db.one<ArtistRow>(`select ${ARTIST_COLS} from artists a where a.id = $1`, [id]));
}

export async function listStops(artistId: string, opts: { publicOnly?: boolean } = {}): Promise<TourStop[]> {
  const db = await getDb();
  const rows = await db.query<TourStop>(
    `select t.id, t.city, t.country, t.studio_name, t.address, t.timezone, t.starts_on, t.ends_on, t.is_home, t.status,
            (select count(*) from waitlist w where w.tour_stop_id = t.id and w.notified_at is null) as waitlist_count
       from tour_stops t
      where t.artist_id = $1 ${opts.publicOnly ? "and t.status <> 'done' and (t.ends_on is null or t.ends_on >= current_date)" : ""}
      order by t.is_home desc, t.starts_on nulls first`,
    [artistId],
  );
  return rows.map(normStop);
}

export async function listPortfolio(artistId: string, opts: { publishedOnly?: boolean } = {}): Promise<PortfolioItem[]> {
  const db = await getDb();
  const rows = await db.query<Omit<PortfolioItem, "url"> & { image_path: string | null }>(
    `select id, title, style, color_mode, placement, is_healed, published, image_path from portfolio_items
      where artist_id = $1 ${opts.publishedOnly ? "and published" : ""} order by sort, created_at desc`,
    [artistId],
  );
  return Promise.all(rows.map(async ({ image_path, ...r }) => ({ ...r, url: image_path ? await fileUrl("public", image_path) : null })));
}

/** Where the public asks the artist to come: city requests not yet tied to a stop, biggest first. */
export async function listCityDemand(artistId: string, limit = 12): Promise<{ city: string; n: number }[]> {
  const db = await getDb();
  const rows = await db.query<{ city: string; n: number }>(
    `select min(city) as city, count(*)::int as n from waitlist
      where artist_id = $1 and tour_stop_id is null and notified_at is null
      group by lower(city) order by n desc, min(city) limit $2`,
    [artistId, limit],
  );
  return rows.map((r) => ({ city: r.city, n: Number(r.n) }));
}

export interface ArtistCard {
  slug: string;
  display_name: string;
  headline: string | null;
  home_city: string | null;
  styles: string[];
  accent: string | null;
  cover_poster: boolean;
  portrait_url: string | null;
}

/** Public artist directory for Explore. */
export async function listArtists(): Promise<ArtistCard[]> {
  const db = await getDb();
  const rows = await db.query<Omit<ArtistCard, "portrait_url"> & { portrait_path: string | null }>(
    `select a.slug, a.display_name, a.headline, a.home_city, a.styles, a.accent, a.cover_poster, a.portrait_path from artists a order by a.created_at`,
  );
  return Promise.all(rows.map(async ({ portrait_path, ...a }) => ({ ...a, portrait_url: portrait_path ? await fileUrl("public", portrait_path) : null })));
}

export async function listFlash(artistId: string, opts: { publishedOnly?: boolean } = {}): Promise<FlashItem[]> {
  const db = await getDb();
  const rows = await db.query<Omit<FlashItem, "url"> & { image_path: string | null }>(
    `select id, title, description, size_label, price_cents, currency, status, repeatable, published, image_path from flash_designs
      where artist_id = $1 ${opts.publishedOnly ? "and published" : ""} order by sort, created_at desc`,
    [artistId],
  );
  return Promise.all(rows.map(async ({ image_path, ...r }) => ({ ...r, url: image_path ? await fileUrl("public", image_path) : null })));
}

/* ------------------------------------------------------------------ briefs */

export type BriefStatus = "new" | "needs_info" | "quoted" | "booked" | "declined" | "archived";
export type InboxTab = "new" | "needs_info" | "quoted" | "booked" | "closed";

export interface BriefListItem {
  id: string;
  ref: string;
  status: BriefStatus;
  client_name: string;
  placement: string;
  full_coverage: boolean;
  size_w_cm: number | null;
  size_h_cm: number | null;
  style: string;
  color_mode: string;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  currency: string;
  city: string | null;
  created_at: Date;
  seen_at: Date | null;
}

const TAB_STATUSES: Record<InboxTab, BriefStatus[]> = {
  new: ["new"],
  needs_info: ["needs_info"],
  quoted: ["quoted"],
  booked: ["booked"],
  closed: ["declined", "archived"],
};

export async function inboxCounts(studioId: string): Promise<Record<InboxTab, number>> {
  const db = await getDb();
  const rows = await db.query<{ status: BriefStatus; n: number }>(`select status, count(*)::int as n from briefs where studio_id = $1 group by status`, [studioId]);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return Object.fromEntries(
    (Object.keys(TAB_STATUSES) as InboxTab[]).map((tab) => [tab, TAB_STATUSES[tab].reduce((n, s) => n + (by[s] ?? 0), 0)]),
  ) as Record<InboxTab, number>;
}

export async function listBriefs(studioId: string, tab: InboxTab, search?: string): Promise<BriefListItem[]> {
  const db = await getDb();
  const q = search?.trim();
  return db.query<BriefListItem>(
    `select b.id, b.ref, b.status, c.name as client_name, b.placement, b.full_coverage, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm,
            b.style, b.color_mode, b.budget_min_cents, b.budget_max_cents, b.currency, t.city, b.created_at, b.seen_at
       from briefs b join clients c on c.id = b.client_id left join tour_stops t on t.id = b.tour_stop_id
      where b.studio_id = $1 and b.status = any($2::text[])
        ${q ? "and (c.name ilike $3 or b.ref ilike $3 or c.email ilike $3)" : ""}
      order by b.created_at desc limit 200`,
    q ? [studioId, TAB_STATUSES[tab], `%${q}%`] : [studioId, TAB_STATUSES[tab]],
  );
}

export interface BriefDetail extends BriefListItem {
  artist_id: string;
  body: "f" | "m";
  body_height_cm: number | null;
  placement_detail: { point?: [number, number, number]; normal?: [number, number, number]; rotation_deg?: number };
  description: string;
  avoid: string | null;
  is_coverup: boolean;
  is_first_tattoo: boolean;
  timing: "asap" | "flexible" | "specific";
  preferred_dates: string | null;
  tour_stop_id: string | null;
  attribution: Record<string, string>;
  client_id: string;
  client_email: string;
  client_phone: string | null;
  client_instagram: string | null;
  client_locale: "en" | "es";
  flash_title: string | null;
  files: { id: string; kind: "reference" | "skin" | "placement"; url: string }[];
  events: { id: string; kind: string; actor: string; body: string | null; data: Record<string, unknown>; created_at: Date }[];
  quote: { id: string; token: string; status: string; deposit_cents: number; currency: string; created_at: Date } | null;
}

export async function getBrief(studioId: string, briefId: string): Promise<BriefDetail | null> {
  const db = await getDb();
  const b = await db.one<Omit<BriefDetail, "files" | "events" | "quote">>(
    `select b.id, b.ref, b.status, b.artist_id, c.name as client_name, b.placement, b.full_coverage, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm,
            b.style, b.color_mode, b.budget_min_cents, b.budget_max_cents, b.currency, t.city, b.created_at, b.seen_at,
            b.body, b.body_height_cm, b.placement_detail, b.description, b.avoid, b.is_coverup, b.is_first_tattoo, b.timing, b.preferred_dates,
            b.tour_stop_id, b.attribution, c.id as client_id, c.email as client_email, c.phone as client_phone, c.instagram as client_instagram, c.locale as client_locale,
            f.title as flash_title
       from briefs b join clients c on c.id = b.client_id left join tour_stops t on t.id = b.tour_stop_id left join flash_designs f on f.id = b.flash_id
      where b.studio_id = $1 and b.id = $2`,
    [studioId, briefId],
  );
  if (!b) return null;
  const [files, events, quote] = await Promise.all([
    db.query<{ id: string; kind: "reference" | "skin" | "placement"; path: string }>(`select id, kind, path from brief_files where brief_id = $1 order by created_at`, [briefId]),
    db.query<BriefDetail["events"][number]>(`select id, kind, actor, body, data, created_at from brief_events where brief_id = $1 order by created_at`, [briefId]),
    db.one<NonNullable<BriefDetail["quote"]>>(`select id, token, status, deposit_cents, currency, created_at from quotes where brief_id = $1 order by created_at desc limit 1`, [briefId]),
  ]);
  return {
    ...b,
    files: await Promise.all(files.map(async (f) => ({ id: f.id, kind: f.kind, url: await fileUrl("private", f.path) }))),
    events,
    quote,
  };
}

/* ------------------------------------------------------------------ quotes */

export interface QuoteSlot {
  id: string;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  status: "offered" | "held" | "booked" | "released";
  hold_expires_at: Date | null;
  city: string | null;
  studio_name: string | null;
  address: string | null;
}

export interface QuoteView {
  id: string;
  studio_id: string;
  token: string;
  status: "sent" | "viewed" | "paid" | "expired" | "withdrawn";
  price_min_cents: number;
  price_max_cents: number | null;
  sessions: number;
  hours_per_session: number | null;
  deposit_cents: number;
  currency: string;
  message: string | null;
  policy: DepositPolicy;
  expires_at: Date;
  brief_id: string;
  placement: string;
  full_coverage: boolean;
  size_w_cm: number | null;
  size_h_cm: number | null;
  style: string;
  color_mode: string;
  client_name: string;
  client_email: string;
  client_locale: "en" | "es";
  artist_id: string;
  artist_name: string;
  artist_slug: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  slots: QuoteSlot[];
  appointment: { starts_at: Date; timezone: string; city: string | null; studio_name: string | null; address: string | null } | null;
  paid_cents: number | null;
}

export async function getQuoteByToken(token: string): Promise<QuoteView | null> {
  if (!token || token.length < 24 || token.length > 64) return null;
  const db = await getDb();
  const q = await db.one<Omit<QuoteView, "slots" | "appointment" | "paid_cents">>(
    `select q.id, q.studio_id, q.token, q.status, q.price_min_cents, q.price_max_cents, q.sessions, q.hours_per_session::float as hours_per_session,
            q.deposit_cents, q.currency, q.message, q.policy, q.expires_at, q.brief_id,
            b.placement, b.full_coverage, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm, b.style, b.color_mode,
            c.name as client_name, c.email as client_email, c.locale as client_locale,
            a.id as artist_id, a.display_name as artist_name, a.slug as artist_slug, a.stripe_account_id, a.stripe_charges_enabled
       from quotes q join briefs b on b.id = q.brief_id join clients c on c.id = b.client_id join artists a on a.id = q.artist_id
      where q.token = $1`,
    [token],
  );
  if (!q) return null;
  const [slots, appointment, paid] = await Promise.all([
    db.query<QuoteSlot>(
      `select s.id, s.starts_at, s.ends_at, s.timezone, s.status, s.hold_expires_at, t.city, t.studio_name, t.address
         from quote_slots s left join tour_stops t on t.id = s.tour_stop_id where s.quote_id = $1 order by s.starts_at`,
      [q.id],
    ),
    db.one<NonNullable<QuoteView["appointment"]>>(
      `select ap.starts_at, ap.timezone, ap.city, t.studio_name, t.address
         from appointments ap left join quote_slots s on s.id = ap.slot_id left join tour_stops t on t.id = s.tour_stop_id
        where ap.quote_id = $1 and ap.status <> 'cancelled' order by ap.created_at desc limit 1`,
      [q.id],
    ),
    db.one<{ amount: number }>(`select sum(amount_cents)::int as amount from payments where quote_id = $1 and status = 'paid'`, [q.id]),
  ]);
  return { ...q, slots, appointment, paid_cents: paid?.amount ?? null };
}

/* ------------------------------------------------------------------ bookings */

export interface AppointmentItem {
  id: string;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  city: string | null;
  status: "confirmed" | "completed" | "no_show" | "cancelled";
  client_name: string;
  client_email: string;
  placement: string | null;
  brief_id: string | null;
  deposit_cents: number | null;
  currency: string | null;
}

export async function listAppointments(studioId: string): Promise<AppointmentItem[]> {
  const db = await getDb();
  return db.query<AppointmentItem>(
    `select ap.id, ap.starts_at, ap.ends_at, ap.timezone, ap.city, ap.status, c.name as client_name, c.email as client_email,
            b.placement, ap.brief_id, p.amount_cents as deposit_cents, p.currency
       from appointments ap join clients c on c.id = ap.client_id left join briefs b on b.id = ap.brief_id
       left join payments p on p.appointment_id = ap.id and p.status = 'paid'
      where ap.studio_id = $1 order by ap.starts_at`,
    [studioId],
  );
}
