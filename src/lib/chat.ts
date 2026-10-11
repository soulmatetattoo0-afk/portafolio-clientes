import type { Locale } from "@/i18n";

import { getDb, type Db } from "./db";
import { fileUrl } from "./storage";

/**
 * The conversation behind every request. It lives in brief_events next to the
 * brief's history: the request itself opens it, then messages from either
 * side, the artist's reservation offers and the booking. The client reads it
 * through the brief's private chat link; the artist from the studio.
 */

export interface ChatOffer {
  token: string;
  status: "sent" | "viewed" | "paid" | "expired" | "withdrawn";
  deposit_cents: number;
  price_min_cents: number;
  price_max_cents: number | null;
  currency: string;
  expires_at: string;
  /** Past its deadline, worked out on the server. */
  expired: boolean;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  city: string | null;
  studio_name: string | null;
}

export interface ChatItem {
  id: string;
  actor: "client" | "artist" | "system";
  kind: "created" | "message" | "offer" | "paid" | "declined";
  body: string | null;
  at: string;
  offer?: ChatOffer;
}

/** The request as the client sent it: the card pinned to the top of the conversation. */
export interface ChatCard {
  id: string;
  ref: string;
  status: string;
  style: string;
  color_mode: string;
  placement: string;
  full_coverage: boolean;
  size_w_cm: number | null;
  size_h_cm: number | null;
  body: "f" | "m";
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
  created_at: string;
  files: { id: string; kind: string; url: string }[];
}

export interface ChatThread {
  card: ChatCard;
  items: ChatItem[];
  client: { name: string; email: string; locale: Locale };
  artist: { id: string; slug: string; name: string; accent: string | null; portrait_url: string | null; studio_id: string };
  chat_token: string;
}

const KIND: Record<string, ChatItem["kind"] | null> = {
  created: "created",
  message: "message",
  info_requested: "message",
  client_replied: "message",
  offer: "offer",
  quoted: "offer",
  paid: "paid",
  declined: "declined",
};

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d));

async function loadThread(db: Db, where: string, param: string): Promise<ChatThread | null> {
  const b = await db.one<ChatCard & { client_name: string; client_email: string; client_locale: Locale; artist_id: string; studio_id: string; chat_token: string }>(
    `select b.id, b.ref, b.status, b.style, b.color_mode, b.placement, b.full_coverage, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm,
            b.body, b.description, b.avoid, b.is_coverup, b.is_first_tattoo, b.timing, b.preferred_dates, b.budget_min_cents, b.budget_max_cents,
            b.currency, t.city, b.created_at, b.artist_id, b.studio_id, b.chat_token,
            c.name as client_name, c.email as client_email, c.locale as client_locale
       from briefs b join clients c on c.id = b.client_id left join tour_stops t on t.id = b.tour_stop_id
      where ${where}`,
    [param],
  );
  if (!b) return null;
  const [events, files, artist] = await Promise.all([
    db.query<{ id: string; kind: string; actor: ChatItem["actor"]; body: string | null; data: Record<string, unknown>; created_at: Date }>(
      `select id, kind, actor, body, data, created_at from brief_events where brief_id = $1 order by created_at`,
      [b.id],
    ),
    db.query<{ id: string; kind: string; path: string }>(`select id, kind, path from brief_files where brief_id = $1 and kind <> 'placement' order by created_at`, [b.id]),
    db.one<{ id: string; slug: string; display_name: string; accent: string | null; portrait_path: string | null; studio_id: string }>(
      `select id, slug, display_name, accent, portrait_path, studio_id from artists where id = $1`,
      [b.artist_id],
    ),
  ]);
  const quoteIds = events.map((e) => (typeof e.data?.quote_id === "string" ? e.data.quote_id : null)).filter((x): x is string => Boolean(x));
  const offers = quoteIds.length
    ? await db.query<Omit<ChatOffer, "expired"> & { id: string }>(
        `select q.id, q.token, q.status, q.deposit_cents, q.price_min_cents, q.price_max_cents, q.currency, q.expires_at,
                s.starts_at, s.ends_at, s.timezone, t.city, t.studio_name
           from quotes q
           left join lateral (select * from quote_slots s where s.quote_id = q.id order by (s.status = 'booked') desc, s.starts_at limit 1) s on true
           left join tour_stops t on t.id = s.tour_stop_id
          where q.id = any($1::uuid[])`,
        [quoteIds],
      )
    : [];
  const offerBy = new Map(offers.map((o) => [o.id, o]));

  const items: ChatItem[] = [];
  for (const e of events) {
    const kind = KIND[e.kind];
    if (!kind) continue;
    const item: ChatItem = { id: e.id, actor: e.actor, kind, body: e.body, at: iso(e.created_at) };
    if (kind === "offer") {
      const o = typeof e.data?.quote_id === "string" ? offerBy.get(e.data.quote_id) : undefined;
      if (!o) continue;
      item.offer = {
        token: o.token,
        status: o.status,
        deposit_cents: o.deposit_cents,
        price_min_cents: o.price_min_cents,
        price_max_cents: o.price_max_cents,
        currency: o.currency,
        expires_at: iso(o.expires_at),
        expired: new Date(o.expires_at).getTime() < Date.now(),
        starts_at: o.starts_at ? iso(o.starts_at) : null,
        ends_at: o.ends_at ? iso(o.ends_at) : null,
        timezone: o.timezone,
        city: o.city,
        studio_name: o.studio_name,
      };
    }
    items.push(item);
  }

  const card: Omit<ChatCard, "files"> = {
    id: b.id, ref: b.ref, status: b.status, style: b.style, color_mode: b.color_mode, placement: b.placement, full_coverage: b.full_coverage,
    size_w_cm: b.size_w_cm, size_h_cm: b.size_h_cm, body: b.body, description: b.description, avoid: b.avoid, is_coverup: b.is_coverup,
    is_first_tattoo: b.is_first_tattoo, timing: b.timing, preferred_dates: b.preferred_dates, budget_min_cents: b.budget_min_cents,
    budget_max_cents: b.budget_max_cents, currency: b.currency, city: b.city, created_at: iso(b.created_at),
  };
  return {
    card: {
      ...card,
      files: await Promise.all(files.map(async (f) => ({ id: f.id, kind: f.kind, url: await fileUrl("private", f.path) }))),
    },
    items,
    client: { name: b.client_name, email: b.client_email, locale: b.client_locale },
    artist: {
      id: artist!.id,
      slug: artist!.slug,
      name: artist!.display_name,
      accent: artist!.accent,
      studio_id: artist!.studio_id,
      portrait_url: artist!.portrait_path ? await fileUrl("public", artist!.portrait_path) : null,
    },
    chat_token: b.chat_token,
  };
}

/** The client's side: the conversation behind a private link. */
export async function getChatByToken(token: string): Promise<ChatThread | null> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return null;
  return loadThread(await getDb(), "b.chat_token = $1", token);
}

/** The artist's side: always scoped to their studio. */
export async function getChat(studioId: string, briefId: string): Promise<ChatThread | null> {
  const t = await loadThread(await getDb(), "b.id = $1", briefId);
  return t && t.artist.studio_id === studioId ? t : null;
}
