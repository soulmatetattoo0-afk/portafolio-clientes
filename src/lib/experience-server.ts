import type { Dict, Locale } from "@/i18n";
import type { MyChat } from "@/lib/client";
import { demoMode } from "@/lib/env";
import { getMagazine } from "@/lib/magazine-server";
import { listCityDemand, listFlash, listPortfolio, listSections, listStops, listTakenDays, type Artist } from "@/lib/queries";

/** Everything the artist's page needs, gathered once; the public page and the artist's editable copy share it. */
export async function loadExperience(artist: Artist, t: Dict, locale: Locale, opts: { publishedOnly?: boolean } = {}) {
  const publishedOnly = opts.publishedOnly ?? true;
  const stops = await listStops(artist.id, { publicOnly: true });
  const [portfolio, flash, demand, taken, magazine, sections] = await Promise.all([
    listPortfolio(artist.id, { publishedOnly }),
    listFlash(artist.id, { publishedOnly: true }),
    listCityDemand(artist.id, 6),
    listTakenDays(artist.id, stops),
    getMagazine(artist.id),
    listSections(artist.id),
  ]);
  return { artist, stops, portfolio, sections, flash, demand, taken, following: null as boolean | null, chats: null as MyChat[] | null, related: [], magazine, locale, t, demo: demoMode };
}
