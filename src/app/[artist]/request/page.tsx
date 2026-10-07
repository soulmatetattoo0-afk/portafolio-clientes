import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DemoBanner } from "@/components/Chrome";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { env, live } from "@/lib/env";
import { getArtistBySlug, listStops } from "@/lib/queries";

import { BriefWizard } from "./BriefWizard";

export async function generateMetadata({ params }: PageProps<"/[artist]/request">): Promise<Metadata> {
  const { artist: slug } = await params;
  const [artist, { t }] = await Promise.all([getArtistBySlug(slug), getDict()]);
  return artist ? { title: fill(t.brief.title, { artist: artist.display_name }), robots: { index: false } } : {};
}

export default async function RequestPage({ params }: PageProps<"/[artist]/request">) {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  if (!artist.accepting) redirect(`/${artist.slug}#cities`);
  const [{ t, locale }, stops] = await Promise.all([getDict(), listStops(artist.id, { publicOnly: true })]);
  return (
    <>
      <DemoBanner />
      <BriefWizard
        t={t}
        locale={locale}
        artist={{ slug: artist.slug, name: artist.display_name, styles: artist.styles, minPriceCents: artist.min_price_cents, currency: artist.currency }}
        stops={stops
          .filter((s) => s.status === "booking" || s.status === "announced")
          .map((s) => ({ id: s.id, city: s.city, studio: s.studio_name, startsOn: s.starts_on, endsOn: s.ends_on, home: s.is_home }))}
        storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
      />
    </>
  );
}
