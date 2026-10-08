/**
 * Word to the people who follow an artist: a guest spot announced, the books
 * opened, new work in the magazine. One outbox row per person, deduped so a
 * re-save never mails twice. Basic studios do not fan out; the hooks call
 * this anyway and it returns quietly.
 */
import type { Db } from "./db";
import { enqueueEmail } from "./email";
import { booksOpenToFollower, newWorkToFollower, spotToFollower } from "./messages";
import { can } from "./plan";

export type AlertKind = "spot" | "books_open" | "new_work";

export interface SpotPayload {
  stopId: string;
  city: string;
  citySlug: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

type Payload = { kind: "spot"; payload: SpotPayload } | { kind: "books_open"; payload?: undefined } | { kind: "new_work"; payload?: undefined };

/** The key in client_users.alerts that each kind honours. */
const FLAG: Record<AlertKind, string> = { spot: "spots", books_open: "books_open", new_work: "new_work" };

/** "2026-W41": the ISO week a date falls in, for once-a-week dedupe keys. */
export function isoWeek(d = new Date()): string {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((u.getTime() - start.getTime()) / 86400_000 + 1) / 7);
  return `${u.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function notifyFollowers(db: Db, opts: { artistId: string } & Payload): Promise<number> {
  const artist = await db.one<{ display_name: string; slug: string; trade: string; studio_id: string; plan: string }>(
    `select a.display_name, a.slug, a.trade, a.studio_id, s.plan from artists a join studios s on s.id = a.studio_id where a.id = $1`,
    [opts.artistId],
  );
  if (!artist || !can(artist.plan, "alerts_fanout")) return 0;

  const citySlug = opts.kind === "spot" ? opts.payload.citySlug : null;
  const people = await db.query<{ email: string; locale: "en" | "es" }>(
    `select distinct on (lower(cu.email)) cu.email, cu.locale
       from client_users cu
      where coalesce((cu.alerts->>$2)::boolean, false)
        and (exists (select 1 from follows f where f.user_id = cu.user_id and f.artist_id = $1)
             or ($3::text is not null and exists (select 1 from city_follows cf where cf.user_id = cu.user_id and cf.city_slug = $3 and cf.trade = $4)))
      order by lower(cu.email)`,
    [opts.artistId, FLAG[opts.kind], citySlug, artist.trade],
  );
  if (people.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const week = isoWeek();
  for (const p of people) {
    const base = { artist: artist.display_name, slug: artist.slug, locale: p.locale };
    const email = p.email.toLowerCase();
    if (opts.kind === "spot") {
      const s = opts.payload;
      await enqueueEmail(db, spotToFollower(p.email, { ...base, city: s.city, startsOn: s.startsOn, endsOn: s.endsOn }), {
        studioId: artist.studio_id,
        template: "spot",
        dedupeKey: `spot:${s.stopId}:${email}`,
      });
    } else if (opts.kind === "books_open") {
      await enqueueEmail(db, booksOpenToFollower(p.email, base), { studioId: artist.studio_id, template: "books_open", dedupeKey: `books:${opts.artistId}:${today}:${email}` });
    } else {
      await enqueueEmail(db, newWorkToFollower(p.email, base), { studioId: artist.studio_id, template: "new_work", dedupeKey: `work:${opts.artistId}:${week}:${email}` });
    }
  }
  return people.length;
}

/** Whether this artist already told followers about new work in the last seven days. */
export async function newWorkSentRecently(db: Db, artistId: string): Promise<boolean> {
  const row = await db.one<{ at: string | Date | null }>(`select max(created_at) as at from outbox where dedupe_key like $1`, [`work:${artistId}:%`]);
  return Boolean(row?.at && Date.now() - new Date(row.at).getTime() < 7 * 86400_000);
}
