/**
 * What each tier can do. Basic is free: a page and its magazine, a gallery,
 * a listing, the chat and the agenda, five new requests a day. Full ($20 a
 * month) lifts the limit and opens the rest. Every payment made in the app
 * (deposit and balance) carries VANTA's fee: the full one on Basic, a smaller
 * one on Full. Founding and the earlier plans count as full.
 */
export type Plan = "basic" | "full" | "founding" | "artist" | "pro" | "studio";
export type Feature = "no_fee" | "flash" | "spots" | "magazine" | "submit" | "alerts_fanout";

export const isFull = (plan: string | null | undefined) => plan !== "basic";

export function can(plan: string | null | undefined, feature: Feature): boolean {
  // The magazine is the artist's page itself: every plan edits it.
  if (feature === "magazine") return true;
  return isFull(plan);
}

/** Basis points of platform fee a payment in the app carries for this plan. */
export function feeBpsFor(plan: string | null | undefined, fees: { basic: number; full: number }): number {
  return isFull(plan) ? fees.full : fees.basic;
}

/**
 * Basic pages read this many new requests a day. Past it the requests still
 * arrive and the artist sees that someone wrote, blurred, until the next day
 * or until they move to Full. Nobody's request is ever lost.
 */
export const FREE_DAILY_REQUESTS = 5;

/**
 * Requests a basic studio can't open yet: those past the daily allowance, by
 * arrival order within each day (New York's calendar). Any request the artist
 * already answered stays open.
 */
export function lockedSql(studioParam: string) {
  return `select b.id from (
      select b.id, row_number() over (partition by (b.created_at at time zone 'America/New_York')::date order by b.created_at) as n
        from briefs b where b.studio_id = ${studioParam}
    ) b
   where b.n > ${FREE_DAILY_REQUESTS}
     and not exists (select 1 from brief_events e where e.brief_id = b.id and e.actor = 'artist')`;
}
