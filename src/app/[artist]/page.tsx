import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { getDict } from "@/i18n/server";
import { getClientUser, isFollowing } from "@/lib/client";
import { relatedArtists } from "@/lib/search";
import { demoMode } from "@/lib/env";
import { getArtistBySlug, listCityDemand, listFlash, listPortfolio, listStops, listTakenDays } from "@/lib/queries";

import { ArtistExperience } from "./experience/ArtistExperience";

export async function generateMetadata({ params }: PageProps<"/[artist]">): Promise<Metadata> {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return {};
  return {
    title: artist.display_name,
    description: artist.headline ?? undefined,
    openGraph: artist.portrait_url ? { images: [artist.portrait_url] } : undefined,
  };
}

/**
 * The artist's public page is one staged experience (cover, deck, panels)
 * rendered on the client; the server only gathers what it needs.
 */
export default async function ArtistPage({ params }: PageProps<"/[artist]">) {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  const stops = await listStops(artist.id, { publicOnly: true });
  const [{ t, locale }, portfolio, flash, demand, taken, me, related] = await Promise.all([
    getDict(),
    listPortfolio(artist.id, { publishedOnly: true }),
    listFlash(artist.id, { publishedOnly: true }),
    listCityDemand(artist.id, 6),
    listTakenDays(artist.id, stops),
    getClientUser(),
    relatedArtists(artist.id, 6),
  ]);
  const following = me ? await isFollowing(me.userId, artist.id) : null;
  return <ArtistExperience data={{ artist, stops, portfolio, flash, demand, taken, following, related, locale, t, demo: demoMode }} />;
}
