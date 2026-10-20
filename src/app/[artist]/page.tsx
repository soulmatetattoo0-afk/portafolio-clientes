import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDict } from "@/i18n/server";
import { fill } from "@/i18n";
import { getMember } from "@/lib/auth";
import { env, live } from "@/lib/env";
import { getArtistBySlug } from "@/lib/queries";
import { getStudioFront } from "@/lib/studio-front";
import { FrontPage } from "@/v2/pages";

import { StudioExperience } from "./house/StudioExperience";

export async function generateMetadata({ params }: PageProps<"/[artist]">): Promise<Metadata> {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) {
    const studio = await getStudioFront(slug);
    return studio ? { title: studio.name, description: studio.about ?? undefined } : {};
  }
  return { title: artist.display_name, description: artist.headline ?? undefined, openGraph: artist.portrait_url ? { images: [artist.portrait_url] } : undefined };
}

/** The artist's page as the client sees it: the four doors. */
export default async function ArtistPage({ params }: PageProps<"/[artist]">) {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) {
    // Not an artist: a studio with several artists has its own front at the same kind of address.
    const studio = await getStudioFront(slug);
    if (!studio) notFound();
    const { t, locale } = await getDict();
    return <StudioExperience studio={studio} t={t} locale={locale} storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null} />;
  }
  if (!artist.launched_at) {
    const member = await getMember().catch(() => null);
    if (member?.studioId !== artist.studio_id) {
      const { t } = await getDict();
      return (
        <main className="poster grid min-h-dvh place-items-center px-6 text-center" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
          <div className="max-w-md">
            <p className="p-display text-[clamp(2.4rem,10vw,4rem)] leading-[0.9]" style={{ color: "var(--accent)" }}>
              {fill(t.soon.title, { name: artist.display_name })}
            </p>
            <p className="mt-4 text-bone/80">{t.soon.lead}</p>
          </div>
        </main>
      );
    }
  }
  return <FrontPage artist={artist} owner={false} base={`/${artist.slug}`} />;
}
