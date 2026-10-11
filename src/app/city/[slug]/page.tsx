import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtistCard } from "@/components/world/ArtistCard";
import { CoverPlate } from "@/components/world/CoverPlate";
import { FollowCity } from "@/components/world/FollowCity";
import { BottomTabs } from "@/components/world/BottomTabs";
import { WorldBar } from "@/components/world/WorldBar";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { followedCities, followedIds, getClientUser } from "@/lib/client";
import { dateRange } from "@/lib/format";
import { getDb } from "@/lib/db";
import { cityPage } from "@/lib/search";
import { CARD_COLS, CARD_JOINS, CARD_SQL, toCard, type ArtistCard as Card, type CardRow } from "@/lib/queries";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);

export async function generateMetadata({ params }: PageProps<"/city/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [{ t }, page] = await Promise.all([getDict(), cityPage(clean(slug))]);
  if (!page) return {};
  const n = page.based.length + page.visiting.length;
  return { title: fill(t.city.title, { n, city: page.city }), description: t.explore.lead };
}

/** The artists a signed-in person follows who are not in this city: the ones to ask to come. */
async function followedElsewhere(userId: string, slug: string, limit = 3): Promise<Card[]> {
  const db = await getDb();
  const rows = await db.query<CardRow>(
    `${CARD_SQL} select ${CARD_COLS} from follows fo join artists a on a.id = fo.artist_id ${CARD_JOINS}
      where fo.user_id = $1 and a.listed and coalesce(a.city_slug, '') <> $2 order by fo.created_at desc limit $3`,
    [userId, slug, limit],
  );
  return Promise.all(rows.map(toCard));
}

/**
 * A city: who is based here, who is passing through and when, a way to hear
 * about the next one, and a way to ask the artists you follow to come.
 */
export default async function CityPage({ params }: PageProps<"/city/[slug]">) {
  const { slug: raw } = await params;
  const slug = clean(raw);
  const [{ t, locale }, page, me] = await Promise.all([getDict(), cityPage(slug), getClientUser()]);
  if (!page) notFound();
  const c = t.city;
  const [following, cities, ask] = await Promise.all([me ? followedIds(me.userId) : null, me ? followedCities(me.userId) : null, me ? followedElsewhere(me.userId, slug) : []]);
  const n = page.based.length + page.visiting.length;
  const tone = (s: string) => (s === "booking" ? "text-accent" : s === "full" ? "text-oxblood" : "text-bone-dim");
  const status = (s: string) => t.artist.status[s as keyof typeof t.artist.status] ?? s;

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": BRAND.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <WorldBar back={{ href: "/explore", label: c.back }} next={`/city/${slug}`} />

      <main className="relative mx-auto w-full max-w-[1280px] px-4 pt-4 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            {page.country && <p className="p-stamp text-bone-dim">{page.country}</p>}
            <h1 className="p-display mt-1 text-[clamp(3.4rem,17vw,7rem)] leading-[0.86] text-bone">{page.city}</h1>
            <p className="p-gothic mt-2 text-[1.3rem] text-accent">{n === 1 ? c.count.one : fill(c.count.many, { n })}</p>
          </div>
          <div className="max-w-[22rem]">
            <FollowCity city={page.city} following={cities ? cities.has(slug) : null} labels={{ follow: fill(c.follow, { city: page.city }), following: fill(c.following, { city: page.city }) }} />
            <p className="mt-2 text-[0.85rem] text-bone-dim">{fill(c.followLead, { city: page.city })}</p>
          </div>
        </header>

        <section className="mt-10" aria-labelledby="based">
          <h2 id="based" className="p-display text-[clamp(2rem,9vw,3rem)] text-bone">
            {fill(c.based, { city: page.city })}
          </h2>
          {page.based.length === 0 ? (
            <p className="mt-3 max-w-[40ch] text-bone/80">{fill(c.basedEmpty, { city: page.city })}</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {page.based.map((a, i) => (
                <li key={a.id}>
                  <ArtistCard artist={a} locale={locale} following={following ? following.has(a.id) : null} lead={i === 0} priority={i < 2} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12" aria-labelledby="visiting">
          <h2 id="visiting" className="p-display text-[clamp(2rem,9vw,3rem)] text-bone">
            {fill(c.visiting, { city: page.city })}
          </h2>
          {page.visiting.length === 0 ? (
            <p className="mt-3 max-w-[40ch] text-bone/80">{fill(c.visitingEmpty, { city: page.city })}</p>
          ) : (
            <ol className="mt-4 grid gap-2 md:grid-cols-2">
              {page.visiting.map(({ artist, stop }) => (
                <li key={stop.id}>
                  <Link href={`/${artist.slug}#spots`} className="flex items-center gap-3 rounded-[14px] border border-line bg-ink-2 p-2 pr-3 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
                    <span className="relative h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-[8px] bg-ink [container-type:inline-size]">
                      {artist.portrait_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.portrait_url} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
                      ) : (
                        <CoverPlate name={artist.display_name} compact />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="p-display block truncate text-[1.35rem] leading-none text-bone">{artist.display_name}</span>
                      <span className="p-gothic mt-1 block text-[1.05rem] leading-tight text-accent">{stop.starts_on ? dateRange(stop.starts_on, stop.ends_on, locale) : status("announced")}</span>
                      {stop.studio_name && <span className="p-stamp mt-1 block truncate text-[0.55rem] text-bone-dim">{stop.studio_name}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`p-stamp rounded-full border border-current px-2 py-1 text-[0.55rem] ${tone(stop.status)}`}>{status(stop.status)}</span>
                      <span className="p-stamp text-[0.55rem] text-bone-dim">{c.seeStops} →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-12 rounded-[18px] border border-line bg-ink-2 p-5" aria-labelledby="ask">
          <p className="p-gothic text-[1.2rem] text-accent">{c.ask.title}</p>
          <h2 id="ask" className="p-display mt-1 text-[clamp(2rem,9vw,3rem)] leading-[0.9] text-bone">
            {page.city}
          </h2>
          {!me ? (
            <>
              <p className="mt-3 max-w-[40ch] text-bone/80">{fill(c.ask.lead, { city: page.city })}</p>
              <Link href={`/me/signin?next=${encodeURIComponent(`/city/${slug}`)}`} className="btn btn-secondary mt-4">
                {c.ask.signIn}
              </Link>
            </>
          ) : ask.length === 0 ? (
            <p className="mt-3 max-w-[40ch] text-bone/80">{fill(c.ask.none, { city: page.city })}</p>
          ) : (
            <>
              <p className="mt-3 max-w-[40ch] text-bone/80">{fill(c.ask.lead, { city: page.city })}</p>
              <ul className="mt-4 grid gap-2">
                {ask.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-t border-line pt-3">
                    <span className="min-w-0">
                      <span className="p-display block truncate text-[1.3rem] leading-none text-bone">{a.display_name}</span>
                      {a.home_city && <span className="p-stamp mt-1 block text-[0.55rem] text-bone-dim">{a.home_city}</span>}
                    </span>
                    <Link href={`/${a.slug}#spots`} className="btn btn-secondary btn-sm shrink-0">
                      {fill(c.ask.cta, { artist: a.display_name.split(" ")[0] })}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
      <BottomTabs />
    </div>
  );
}
