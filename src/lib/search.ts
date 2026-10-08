/**
 * Finding an artist: one SQL statement over the artists table with the card
 * facets, ranked in the database. No external search service; Postgres full
 * text on name, headline, city, country and styles, plus filters that read
 * straight off the columns the studio already writes.
 */
import { getDb } from "./db";
import { citySlug } from "./geo";
import { CARD_COLS, CARD_JOINS, CARD_SQL, toCard, type ArtistCard, type CardRow } from "./queries";
import { isTrade, type Trade } from "./catalog";

export type Sort = "match" | "next" | "distance" | "newest";

export interface SearchParams {
  q?: string;
  trade?: Trade;
  styles?: string[];
  city?: string;
  color?: "black_grey" | "color";
  healed?: boolean;
  priceMax?: number;
  available?: "now" | "guest";
  near?: { lat: number; lng: number };
  sort?: Sort;
  page?: number;
}

export interface SearchResult {
  items: ArtistCard[];
  total: number;
  /** Which filters were dropped to find anything at all, in order. */
  relaxed: ("city" | "styles" | "color")[];
}

const PAGE = 24;

/** Parse the URL's searchParams into a SearchParams, ignoring anything malformed. */
export function parseSearch(sp: Record<string, string | string[] | undefined>): SearchParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : Array.isArray(sp[k]) ? (sp[k] as string[])[0] : undefined);
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : typeof sp[k] === "string" ? (sp[k] as string).split(",") : []).map((s) => s.trim()).filter(Boolean);
  const near = one("near")?.split(",").map(Number);
  const sort = one("sort");
  const color = one("color");
  const available = one("available");
  const trade = one("trade");
  return {
    q: one("q")?.trim().slice(0, 80) || undefined,
    trade: isTrade(trade) ? trade : "tattoo",
    styles: many("styles").slice(0, 6),
    city: one("city")?.trim().slice(0, 60) || undefined,
    color: color === "black_grey" || color === "color" ? color : undefined,
    healed: one("healed") === "1",
    priceMax: one("priceMax") ? Math.max(0, Number(one("priceMax"))) || undefined : undefined,
    available: available === "now" || available === "guest" ? available : undefined,
    near: near && near.length === 2 && near.every((n) => Number.isFinite(n)) ? { lat: near[0], lng: near[1] } : undefined,
    sort: sort === "next" || sort === "distance" || sort === "newest" ? sort : "match",
    page: Math.max(0, Number(one("page")) || 0),
  };
}

async function run(p: SearchParams): Promise<{ items: ArtistCard[]; total: number }> {
  const db = await getDb();
  const args: unknown[] = [];
  const arg = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };
  const where: string[] = ["a.listed", `a.trade = ${arg(p.trade ?? "tattoo")}`];
  const rank: string[] = ["(a.portrait_path is not null)::int", "least(coalesce(f.featured_count, 0), 3) * 0.5", "a.accepting::int"];
  if (p.q) {
    const q = arg(p.q);
    where.push(`(a.search @@ websearch_to_tsquery('simple', ${q}) or a.display_name ilike '%' || ${q} || '%')`);
    rank.push(`ts_rank(a.search, websearch_to_tsquery('simple', ${q})) * 4`);
  }
  if (p.styles?.length) {
    const st = arg(p.styles);
    where.push(`a.styles && ${st}::text[]`);
    rank.push(`(a.styles && ${st}::text[])::int * 3`);
  }
  if (p.city) {
    const c = arg(citySlug(p.city));
    where.push(`(a.city_slug = ${c} or ns.city_slug = ${c})`);
    rank.push(`(a.city_slug = ${c})::int * 3 + (ns.city_slug = ${c})::int * 2`);
  }
  if (p.color === "color") where.push("coalesce(f.has_color, false)");
  if (p.color === "black_grey") where.push("coalesce(f.has_black_grey, false)");
  if (p.healed) where.push("coalesce(f.has_healed, false)");
  if (p.priceMax) where.push(`(a.min_price_cents is null or a.min_price_cents <= ${arg(p.priceMax)})`);
  if (p.available === "now") where.push("a.accepting");
  if (p.available === "guest") where.push("ns.id is not null");

  let distance = "null::float";
  if (p.near) {
    const lat = arg(p.near.lat);
    const lng = arg(p.near.lng);
    const km = (la: string, lo: string) =>
      `(2 * 6371 * asin(sqrt(power(sin(radians(${la} - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(${la})) * power(sin(radians(${lo} - ${lng}) / 2), 2))))`;
    distance = `least(coalesce(${km("a.lat", "a.lng")}, 1e9), coalesce(${km("ns.lat", "ns.lng")}, 1e9))`;
  }
  const order =
    p.sort === "distance" && p.near
      ? "distance_km asc nulls last, rank desc"
      : p.sort === "next"
        ? "coalesce(ns.starts_on, case when a.accepting then current_date end) asc nulls last, rank desc"
        : p.sort === "newest"
          ? "f.last_published desc nulls last, rank desc"
          : "rank desc, f.last_published desc nulls last, a.created_at";
  const offset = (p.page ?? 0) * PAGE;
  const rows = await db.query<CardRow & { total: number | string }>(
    `${CARD_SQL}
     select ${CARD_COLS}, (${rank.join(" + ")})::float as rank, ${distance} as distance_km, count(*) over() as total
       from artists a ${CARD_JOINS}
      where ${where.join(" and ")}
      order by ${order}
      limit ${PAGE} offset ${offset}`,
    args,
  );
  return { items: await Promise.all(rows.map(toCard)), total: rows.length ? Number(rows[0].total) : 0 };
}

/**
 * Search, and when nothing matches, loosen the filters in a fixed order
 * (city, then styles, then colour) so the page can say what it dropped.
 */
export async function searchArtists(p: SearchParams): Promise<SearchResult> {
  const relaxed: SearchResult["relaxed"] = [];
  let r = await run(p);
  const steps: { key: "city" | "styles" | "color"; apply: (q: SearchParams) => SearchParams }[] = [
    { key: "city", apply: (q) => ({ ...q, city: undefined }) },
    { key: "styles", apply: (q) => ({ ...q, styles: [] }) },
    { key: "color", apply: (q) => ({ ...q, color: undefined, healed: false }) },
  ];
  let cur = p;
  for (const step of steps) {
    if (r.total > 0 || (p.page ?? 0) > 0) break;
    const had = step.key === "city" ? Boolean(cur.city) : step.key === "styles" ? Boolean(cur.styles?.length) : Boolean(cur.color || cur.healed);
    if (!had) continue;
    cur = step.apply(cur);
    relaxed.push(step.key);
    r = await run(cur);
  }
  return { ...r, relaxed };
}

/** Artists like this one: same trade, shared styles, same city first, then anyone with a portrait. */
export async function relatedArtists(artistId: string, limit = 6): Promise<ArtistCard[]> {
  const db = await getDb();
  const rows = await db.query<CardRow>(
    `${CARD_SQL}, me as (select id, trade, styles, city_slug from artists where id = $1)
     select ${CARD_COLS}
       from artists a ${CARD_JOINS} cross join me
      where a.listed and a.id <> me.id and a.trade = me.trade
      order by (a.city_slug = me.city_slug)::int desc, cardinality(array(select unnest(a.styles) intersect select unnest(me.styles))) desc, (a.portrait_path is not null)::int desc, a.created_at
      limit $2`,
    [artistId, limit],
  );
  return Promise.all(rows.map(toCard));
}

export interface CityPage {
  slug: string;
  city: string;
  country: string | null;
  based: ArtistCard[];
  visiting: { artist: ArtistCard; stop: { id: string; city: string; starts_on: string | null; ends_on: string | null; status: string; studio_name: string | null } }[];
}

/** Everyone based in a city plus everyone passing through, soonest first. */
export async function cityPage(slug: string, trade: Trade = "tattoo"): Promise<CityPage | null> {
  const db = await getDb();
  const based = await db.query<CardRow>(`${CARD_SQL} select ${CARD_COLS} from artists a ${CARD_JOINS} where a.listed and a.trade = $2 and a.city_slug = $1 order by (a.portrait_path is not null)::int desc, a.created_at`, [slug, trade]);
  const visiting = await db.query<CardRow & { s_id: string; s_city: string; s_starts_on: unknown; s_ends_on: unknown; s_status: string; s_studio_name: string | null }>(
    `${CARD_SQL} select ${CARD_COLS}, t.id as s_id, t.city as s_city, t.starts_on as s_starts_on, t.ends_on as s_ends_on, t.status as s_status, t.studio_name as s_studio_name
       from tour_stops t join artists a on a.id = t.artist_id ${CARD_JOINS}
      where t.city_slug = $1 and not t.is_home and a.listed and a.trade = $2 and t.status in ('announced', 'booking', 'full') and (t.ends_on is null or t.ends_on >= current_date)
      order by t.starts_on nulls last`,
    [slug, trade],
  );
  const name = await db.one<{ city: string; country: string | null }>(
    `select city, country from (select home_city as city, country, 0 as o from artists where city_slug = $1 union all select city, country, 1 from tour_stops where city_slug = $1) x order by o limit 1`,
    [slug],
  );
  if (!name && !based.length && !visiting.length) return null;
  const iso = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
  return {
    slug,
    city: name?.city ?? slug,
    country: name?.country ?? null,
    based: await Promise.all(based.map(toCard)),
    visiting: await Promise.all(
      visiting.map(async (r) => ({ artist: await toCard(r), stop: { id: r.s_id, city: r.s_city, starts_on: iso(r.s_starts_on), ends_on: iso(r.s_ends_on), status: r.s_status, studio_name: r.s_studio_name } })),
    ),
  };
}

export interface SpotCard {
  artist: ArtistCard;
  stop: { id: string; city: string; city_slug: string | null; country: string; starts_on: string | null; ends_on: string | null; status: string };
}

/** Guest spots starting in the next `days`, nearest first when a location is given. */
export async function upcomingSpots(opts: { near?: { lat: number; lng: number }; city?: string; days?: number; trade?: Trade; limit?: number } = {}): Promise<SpotCard[]> {
  const db = await getDb();
  const days = opts.days ?? 45;
  const args: unknown[] = [opts.trade ?? "tattoo", days];
  let where = "";
  let order = "t.starts_on nulls last";
  if (opts.city) {
    args.push(citySlug(opts.city));
    where = `and t.city_slug = $${args.length}`;
  }
  if (opts.near) {
    args.push(opts.near.lat, opts.near.lng);
    order = `coalesce(2 * 6371 * asin(sqrt(power(sin(radians(t.lat - $${args.length - 1}) / 2), 2) + cos(radians($${args.length - 1})) * cos(radians(t.lat)) * power(sin(radians(t.lng - $${args.length}) / 2), 2))), 1e9), t.starts_on nulls last`;
  }
  const rows = await db.query<CardRow & { s_id: string; s_city: string; s_city_slug: string | null; s_country: string; s_starts_on: unknown; s_ends_on: unknown; s_status: string }>(
    `${CARD_SQL} select ${CARD_COLS}, t.id as s_id, t.city as s_city, t.city_slug as s_city_slug, t.country as s_country, t.starts_on as s_starts_on, t.ends_on as s_ends_on, t.status as s_status
       from tour_stops t join artists a on a.id = t.artist_id ${CARD_JOINS}
      where a.listed and a.trade = $1 and not t.is_home and t.status in ('announced', 'booking')
        and t.starts_on is not null and t.starts_on <= current_date + ($2::int) and (t.ends_on is null or t.ends_on >= current_date) ${where}
      order by ${order} limit ${opts.limit ?? 8}`,
    args,
  );
  const iso = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
  return Promise.all(rows.map(async (r) => ({ artist: await toCard(r), stop: { id: r.s_id, city: r.s_city, city_slug: r.s_city_slug, country: r.s_country, starts_on: iso(r.s_starts_on), ends_on: iso(r.s_ends_on), status: r.s_status } })));
}

/** Cities with listed artists, biggest first, for chips and "near you" fallbacks. */
export async function listCities(trade: Trade = "tattoo", limit = 12): Promise<{ slug: string; city: string; country: string | null; n: number }[]> {
  const db = await getDb();
  const rows = await db.query<{ slug: string; city: string; country: string | null; n: number | string }>(
    `select city_slug as slug, min(home_city) as city, min(country) as country, count(*) as n
       from artists where listed and trade = $1 and city_slug is not null
      group by city_slug order by n desc, min(home_city) limit $2`,
    [trade, limit],
  );
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}
