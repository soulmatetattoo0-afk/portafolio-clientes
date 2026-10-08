import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { ArtistCard } from "@/components/world/ArtistCard";
import { InstallHint } from "@/components/world/InstallHint";
import { IssueCard } from "@/components/world/IssueCard";
import { NearYou } from "@/components/world/NearYou";
import { SpotCard } from "@/components/world/SpotCard";
import { WorldBar } from "@/components/world/WorldBar";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND, CITY_COOKIE } from "@/lib/brand";
import { TRADES } from "@/lib/catalog";
import { followedIds, getClientUser } from "@/lib/client";
import { cityName, haversineKm, locate } from "@/lib/geo";
import { listCities, searchArtists, upcomingSpots } from "@/lib/search";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getDict();
  return { title: { absolute: `${BRAND.name} · ${BRAND.tagline[locale]}` }, description: t.world.home.kicker };
}

const parseNear = (v: string | string[] | undefined) => {
  const n = (typeof v === "string" ? v : "").split(",").map(Number);
  return n.length === 2 && n.every((x) => Number.isFinite(x)) ? { lat: n[0], lng: n[1] } : undefined;
};

/**
 * The front page of Vanta for the person looking: the masthead, the search,
 * who is near, who is passing through, the issue. Where "near" is comes
 * from the URL (only if they asked), a cookie, or the biggest city.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const [{ t, locale }, sp, jar, me, cities] = await Promise.all([getDict(), searchParams, cookies(), getClientUser(), listCities("tattoo", 10)]);
  const w = t.world;
  const near = parseNear(sp.near);
  const cookieCity = jar.get(CITY_COOKIE)?.value ?? null;

  // The place the strips are about.
  let current: { slug: string; city: string } | null = null;
  if (near) {
    let best: { slug: string; city: string; km: number } | null = null;
    for (const c of cities) {
      const at = locate(c.city);
      if (!at) continue;
      const km = haversineKm(near.lat, near.lng, at[0], at[1]);
      if (!best || km < best.km) best = { slug: c.slug, city: c.city, km };
    }
    current = best && best.km < 400 ? best : null;
  } else {
    const picked = cookieCity ? cities.find((c) => c.slug === cookieCity) : null;
    current = picked ?? (cookieCity ? { slug: cookieCity, city: cityName(cookieCity) } : null) ?? (cities[0] ? { slug: cities[0].slug, city: cities[0].city } : null);
  }

  const [nearby, following, spotsFirst] = await Promise.all([
    near ? searchArtists({ near, sort: "distance" }) : current ? searchArtists({ city: current.slug }) : searchArtists({}),
    me ? followedIds(me.userId) : null,
    upcomingSpots(near ? { near, days: 45, limit: 6 } : current ? { city: current.slug, days: 45, limit: 6 } : { days: 45, limit: 6 }),
  ]);
  const spots = spotsFirst.length ? spotsFirst : await upcomingSpots({ days: 45, limit: 6 });
  const spotsEverywhere = !spotsFirst.length && spots.length > 0;
  const artists = nearby.items.slice(0, 6);
  const place = near && !current ? w.near.around : current ? current.city : w.near.around;
  const month = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "long", year: "numeric" }).format(new Date());
  const followState = (id: string) => (following ? following.has(id) : null);

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": BRAND.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <WorldBar search={false} />

      <main className="relative mx-auto w-full max-w-[1280px] px-4 pb-16">
        {/* The nameplate. */}
        <section className="pt-6 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div>
            <p className="p-stamp text-bone-dim">{fill(w.home.issueLine, { month })}</p>
            <h1 className="p-display mt-1 text-[clamp(5.6rem,30vw,16rem)] leading-[0.8] text-bone">{BRAND.name}</h1>
            <p className="p-quote mt-3 text-[clamp(1.8rem,8vw,3rem)] text-bone">{BRAND.tagline[locale]}</p>
            <p className="p-gothic mt-2 text-[1.25rem] text-accent">{w.home.kicker}</p>
          </div>
          <div className="mt-6 lg:mt-0">
            <form action="/explore" method="get" role="search" className="flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 py-1.5 pr-1.5 pl-4 focus-within:border-bone">
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-bone-dim" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4.5 4.5" />
              </svg>
              <label className="sr-only" htmlFor="home-q">
                {w.home.search}
              </label>
              <input id="home-q" name="q" type="search" enterKeyHint="search" maxLength={80} className="min-w-0 flex-1 bg-transparent py-2 text-[1rem] text-bone outline-none placeholder:text-bone-dim" placeholder={w.home.placeholder} />
              <button type="submit" className="btn btn-primary btn-sm">
                {w.home.search}
              </button>
            </form>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={w.home.trades}>
              {TRADES.map((tr) => (
                <li key={tr.slug}>
                  <Link href={`/explore?trade=${tr.slug}`} className={`chip ${tr.live ? "" : "text-bone-dim"}`} data-active={tr.live} aria-current={tr.live ? "true" : undefined}>
                    {tr.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Near you. */}
        <section className="mt-12" aria-label={w.near.title}>
          <NearYou
            title={w.near.title}
            place={place}
            current={current?.slug ?? null}
            located={Boolean(near)}
            cities={cities}
            labels={{ cities: w.near.cities, useLocation: w.near.useLocation, locating: w.near.locating, denied: w.near.denied, seeAll: fill(w.near.seeAll, { city: current?.city ?? "" }) }}
          />
          {artists.length === 0 ? (
            <p className="mt-4 text-bone-dim">{fill(w.near.empty, { city: place })}</p>
          ) : (
            <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:px-0 lg:grid-cols-6">
              {artists.map((a, i) => (
                <li key={a.id} className="w-[62vw] shrink-0 snap-start sm:w-[16rem] md:w-auto">
                  <ArtistCard artist={a} locale={locale} following={followState(a.id)} lead={i === 0} priority={i < 2} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Passing through. */}
        <section className="mt-12" aria-label={w.spots.title}>
          <p className="p-gothic text-[1.2rem] text-accent">{w.spots.lead}</p>
          <h2 className="p-display mt-0.5 text-[clamp(2.4rem,11vw,3.4rem)] text-bone">
            {w.spots.title} <span className="text-bone-dim">{spotsEverywhere || !current ? w.spots.everywhere : fill(w.spots.inCity, { city: current.city })}</span>
          </h2>
          {spots.length === 0 ? (
            <p className="mt-4 text-bone-dim">{fill(w.spots.empty, { city: place })}</p>
          ) : (
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {spots.map((s, i) => (
                <SpotCard key={s.stop.id} spot={s} locale={locale} lead={i === 0} />
              ))}
            </ul>
          )}
          <p className="mt-3 text-right">
            <Link href="/explore?available=guest" className="p-stamp inline-flex min-h-11 items-center text-bone-dim underline decoration-bone/30 underline-offset-4 hover:text-bone">
              {w.spots.all} →
            </Link>
          </p>
        </section>

        {/* The issue. */}
        <div className="mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
          <IssueCard locale={locale} labels={w.issue} />
          <div className="mt-6 flex flex-col justify-between gap-6 lg:mt-0">
            <Link href="/artists" className="group block rounded-[18px] border border-line p-5 transition-colors hover:border-line-strong">
              <p className="p-gothic text-[1.2rem] text-accent">{w.footer.forArtists}</p>
              <p className="p-display mt-1 text-[2rem] text-bone">{t.landing.title}</p>
              <p className="mt-2 text-[0.95rem] text-bone/80">{w.footer.artistsLead}</p>
            </Link>
            <InstallHint labels={w.install} />
          </div>
        </div>
      </main>

      <footer className="relative mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-6 text-[0.85rem] text-bone-dim">
        <span className="p-display text-[1.2rem] text-bone">{BRAND.name}</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/artists" className="py-2 hover:text-bone">
            {w.footer.forArtists}
          </Link>
          <a href={`https://instagram.com/${BRAND.instagram}`} target="_blank" rel="noopener noreferrer" className="py-2 hover:text-bone">
            @{BRAND.instagram}
          </a>
        </nav>
      </footer>
    </div>
  );
}
