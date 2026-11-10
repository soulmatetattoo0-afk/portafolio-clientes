import { notFound } from "next/navigation";
import { after } from "next/server";

import { DemoBanner } from "@/components/Chrome";
import { getChat, type ChatCard } from "@/lib/chat";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { getMagazine } from "@/lib/magazine-server";
import { getArtistBySlug, listPortfolio, listSections, listStops, listTakenDays, type Artist } from "@/lib/queries";

import { Dates, type DaySession, type Place } from "./Dates";
import { Front } from "./Front";
import type { Slide } from "./FrontMotion";
import { Magazine } from "./Magazine";
import { ArtistTabs, ClientTabs } from "./Shell";
import { countVisit, getViewer } from "./viewer";
import { Work } from "./Work";

/**
 * The artist's app, as both sides see it. The public tree (/{slug}/…) is the
 * client's; the studio tree (/studio/pagina/…) is the artist's own copy, the
 * same screens with the edit buttons inside. These loaders serve both.
 */
type Viewer = Awaited<ReturnType<typeof getViewer>>;

export async function loadArtist(slug: string): Promise<Artist> {
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  return artist;
}

/** The bars at the thumb: the artist's on their own copy, the client's elsewhere. */
export function Bars({ artist, viewer }: { artist: Artist; viewer: Viewer }) {
  const t = viewer.t.v2.tabs;
  if (viewer.owner) return <ArtistTabs slug={artist.slug} labels={{ page: t.page, chats: t.chats, settings: t.settings, bar: viewer.t.studio.nav.label }} badge={viewer.pending} />;
  if (viewer.client) return <ClientTabs labels={{ artists: t.myArtists, messages: t.messages, profile: t.profile, bar: viewer.t.me.nav.label }} badge={viewer.unread} />;
  return null;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function FrontPage({ artist, owner, base }: { artist: Artist; owner: boolean; base: string }) {
  const viewer = await getViewer(artist, { owner });
  const stops = await listStops(artist.id, { publicOnly: true });
  const [portfolio, magazine, taken] = await Promise.all([listPortfolio(artist.id, { publishedOnly: true }), getMagazine(artist.id), listTakenDays(artist.id, stops)]);
  if (!viewer.owner) after(() => countVisit(artist.id, viewer.client?.userId ?? null));
  const pieces = portfolio.filter((p) => p.url);
  const cover = magazine.doc.cover;
  const poster = cover.mode === "poster" && cover.poster ? (magazine.urls[cover.poster] ?? null) : null;
  // The reel behind Obras: the cover the artist chose, then their featured pieces, then the rest; five at most.
  const reel: Slide[] = [];
  const inReel = new Set<string>();
  const add = (url: string | null | undefined, fx = 50, fy = 50, zoom = 1) => {
    if (!url || inReel.has(url) || reel.length >= 5) return;
    inReel.add(url);
    reel.push({ url, fx, fy, zoom });
  };
  add(artist.work_cover_url);
  for (const p of [...pieces.filter((p) => p.featured), ...pieces.filter((p) => !p.featured)]) add(p.url, p.focus_x, p.focus_y, p.zoom);
  // The calendar leaf: the next open day at the home studio; with none in sight (or the book closed), today.
  const home = stops.find((s) => s.is_home);
  const busy = new Set(home ? (taken[home.id] ?? []) : []);
  // Today is the day at the studio, not the server's: late in Santiago it is already tomorrow in UTC.
  let today = new Date(`${isoDay(new Date())}T00:00:00Z`);
  try {
    if (home?.timezone) today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: home.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}T00:00:00Z`);
  } catch {
    // An unknown timezone on the stop: the UTC day stands.
  }
  let next: Date | null = null;
  if (artist.accepting && home) {
    for (let i = 1; i <= 60 && !next; i++) {
      const d = new Date(today.getTime() + i * 86_400_000);
      if (!busy.has(isoDay(d))) next = d;
    }
  }
  const part = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(viewer.locale, { ...o, timeZone: "UTC" }).format(d).replace(".", "");
  const leaf = next
    ? { band: viewer.t.v2.front.nextFree, day: String(next.getUTCDate()), foot: `${part(next, { weekday: "short" })} · ${part(next, { month: "short" })}` }
    : { band: part(today, { month: "long" }), day: String(today.getUTCDate()), foot: part(today, { weekday: "long" }) };
  return (
    <>
      {/* No demo banner here: the page is one phone screen, every line counts. */}
      <Front
        artist={artist}
        reel={reel}
        magazine={{ url: poster ?? artist.portrait_url ?? pieces[1]?.url ?? null, poster: Boolean(poster) }}
        leaf={leaf}
        base={base}
        owner={viewer.owner}
        bar={viewer.owner || Boolean(viewer.client)}
        chats={viewer.chats}
        following={viewer.following}
        t={viewer.t}
        locale={viewer.locale}
      />
      <Bars artist={artist} viewer={viewer} />
    </>
  );
}

export async function WorkPage({ artist, owner, base }: { artist: Artist; owner: boolean; base: string }) {
  const viewer = await getViewer(artist, { owner });
  const [portfolio, sections] = await Promise.all([listPortfolio(artist.id, { publishedOnly: true }), listSections(artist.id)]);
  return (
    <>
      <DemoBanner />
      <Work pieces={portfolio.filter((p) => p.url)} sections={sections} locale={viewer.locale} t={viewer.t} back={base} editHref={viewer.owner ? "/studio/obras" : null} />
      <Bars artist={artist} viewer={viewer} />
    </>
  );
}

export async function MagazinePage({ artist, owner, base }: { artist: Artist; owner: boolean; base: string }) {
  const viewer = await getViewer(artist, { owner });
  const magazine = await getMagazine(artist.id);
  return (
    <>
      <Magazine artist={artist} magazine={magazine} locale={viewer.locale} t={viewer.t} back={base} editHref={viewer.owner ? "/studio/revista" : null} />
      <Bars artist={artist} viewer={viewer} />
    </>
  );
}

export async function DatesPage({ artist, owner, base, edit = false }: { artist: Artist; owner: boolean; base: string; edit?: boolean }) {
  const viewer = await getViewer(artist, { owner });
  const stops = await listStops(artist.id, { publicOnly: true });
  const db = await getDb();
  const today = isoDay(new Date());
  const [taken, portfolio, closed] = await Promise.all([
    listTakenDays(artist.id, stops),
    listPortfolio(artist.id, { publishedOnly: true }),
    db.query<{ day: string }>(`select to_char(day, 'YYYY-MM-DD') as day from days_off where artist_id = $1 and day >= current_date - 31`, [artist.id]),
  ]);
  const places: Place[] = [...stops.filter((s) => s.is_home), ...stops.filter((s) => !s.is_home && s.status !== "done" && (s.ends_on ?? s.starts_on ?? "9999") >= today)].map((s) => ({
    id: s.id, city: s.city, is_home: s.is_home, studio_name: s.studio_name, address: s.address, starts_on: s.starts_on, ends_on: s.ends_on, cover_url: s.cover_url ?? null,
  }));
  // The artist's own copy: their sessions, each with the client's request.
  let sessions: DaySession[] = [];
  const cards: Record<string, ChatCard> = {};
  if (viewer.owner && viewer.member) {
    sessions = await db.query<DaySession>(
      `select ap.id, to_char(ap.starts_at at time zone ap.timezone, 'YYYY-MM-DD') as day, to_char(ap.starts_at at time zone ap.timezone, 'HH24:MI') as time,
              c.name as client, ap.brief_id, ap.city, ap.note, extract(epoch from ap.ends_at - ap.starts_at)::float / 3600 as hours
         from appointments ap join clients c on c.id = ap.client_id
        where ap.artist_id = $1 and ap.status in ('confirmed', 'completed') and ap.starts_at >= now() - interval '31 days'
        order by ap.starts_at`,
      [artist.id],
    );
    const ids = [...new Set(sessions.map((s) => s.brief_id).filter((x): x is string => Boolean(x)))];
    const threads = await Promise.all(ids.map((id) => getChat(viewer.member!.studioId, id)));
    for (const th of threads) if (th) cards[th.card.id] = th.card;
  }
  const pieces = portfolio.filter((p) => p.url);
  const art = artist.calendar_art_url ?? pieces[(new Date().getUTCMonth() + pieces.length) % Math.max(1, pieces.length)]?.url ?? null;
  const quote = artist.cover_quote?.trim() || artist.headline?.trim() || null;
  return (
    <>
      <DemoBanner />
      <Dates
        artist={{ slug: artist.slug, display_name: artist.display_name, accent: artist.accent, accepting: artist.accepting }}
        places={places}
        taken={taken}
        sessions={sessions}
        cards={cards}
        closed={closed.map((c) => c.day)}
        art={art}
        quote={quote}
        locale={viewer.locale}
        t={viewer.t}
        base={base}
        owner={viewer.owner}
        requestHref={`/${artist.slug}/request?ref=agenda-day`}
        startEditing={edit && viewer.owner}
        storage={storageForBrowser()}
      />
      <Bars artist={artist} viewer={viewer} />
    </>
  );
}

export const storageForBrowser = () => (live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null);
