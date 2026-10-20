import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DemoBanner } from "@/components/Chrome";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { getClientUser, getMyContact } from "@/lib/client";
import { env, live } from "@/lib/env";
import { getArtistBySlug, listFlash, listPortfolio, listStops, listTakenDays } from "@/lib/queries";

import { BriefWizard } from "./BriefWizard";

export async function generateMetadata({ params }: PageProps<"/[artist]/request">): Promise<Metadata> {
  const { artist: slug } = await params;
  const [artist, { t }] = await Promise.all([getArtistBySlug(slug), getDict()]);
  return artist ? { title: fill(t.brief.title, { artist: artist.display_name }), robots: { index: false } } : {};
}

export default async function RequestPage({ params, searchParams }: PageProps<"/[artist]/request">) {
  const [{ artist: slug }, sp] = await Promise.all([params, searchParams]);
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  if (!artist.accepting) redirect(`/${artist.slug}#spots`);
  const [{ t, locale }, stops, flashAll, user] = await Promise.all([getDict(), listStops(artist.id, { publicOnly: true }), typeof sp.flash === "string" ? listFlash(artist.id, { publishedOnly: true }) : [], getClientUser()]);
  // Booking starts with an account (username, email, password): the chat, the emails and the booking stay with the person.
  if (!user) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    redirect(`/me/signin?mode=create&for=${encodeURIComponent(artist.display_name)}&next=${encodeURIComponent(`/${artist.slug}/request${qs ? `?${qs}` : ""}`)}`);
  }
  // A signed-in client starts from the details they last gave a studio, else their account.
  const contact = user ? await getMyContact(user.userId) : null;
  const me = user ? { name: contact?.name ?? user.name, email: user.email, phone: contact?.phone ?? null, instagram: contact?.instagram ?? null } : null;
  // A piece of the artist's own work for each style they offer, for the style tiles.
  const portfolio = await listPortfolio(artist.id, { publishedOnly: true });
  const styleImages: Record<string, string> = {};
  for (const p of portfolio) if (p.style && p.url && !styleImages[p.style]) styleImages[p.style] = p.url;
  const picked = flashAll.find((f) => f.id === sp.flash && f.status === "available") ?? null;
  const taken = await listTakenDays(artist.id, stops);
  const pieces = portfolio.filter((p) => p.url);
  const calendar = { art: artist.calendar_art_url ?? pieces[(new Date().getUTCMonth() + pieces.length) % Math.max(1, pieces.length)]?.url ?? null, quote: artist.cover_quote?.trim() || artist.headline?.trim() || null };
  return (
    <>
      <DemoBanner />
      <BriefWizard
        t={t}
        locale={locale}
        artist={{ slug: artist.slug, name: artist.display_name, styles: artist.styles, minPriceCents: artist.min_price_cents, currency: artist.currency, accent: artist.accent }}
        styleImages={styleImages}
        flash={picked ? { id: picked.id, title: picked.title, description: picked.description, sizeLabel: picked.size_label, url: picked.url } : null}
        stops={stops
          .filter((s) => s.status === "booking" || s.status === "announced")
          .map((s) => ({ id: s.id, city: s.city, studio: s.studio_name, startsOn: s.starts_on, endsOn: s.ends_on, home: s.is_home }))}
        storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
        taken={taken}
        calendar={calendar}
        me={me}
        preferredStop={typeof sp.stop === "string" ? sp.stop : null}
        preferredDay={typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null}
      />
    </>
  );
}
