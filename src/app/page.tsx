import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { ArtistCard } from "@/components/world/ArtistCard";
import { InstallHint } from "@/components/world/InstallHint";
import { IssueCard, issueMonth } from "@/components/world/IssueCard";
import { IssueHero } from "@/components/world/IssueHero";
import { NearYou } from "@/components/world/NearYou";
import { SpotTile } from "@/components/world/SpotTile";
import { WorldBar } from "@/components/world/WorldBar";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND, CITY_COOKIE } from "@/lib/brand";
import { TRADES } from "@/lib/catalog";
import { followedIds, getClientUser } from "@/lib/client";
import { cityName, haversineKm, locate } from "@/lib/geo";
import { getIssue, heroStories } from "@/lib/issue/current";
import { listCities, searchArtists, upcomingSpots } from "@/lib/search";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getDict();
  return { title: { absolute: `${BRAND.name} · ${BRAND.tagline[locale]}` }, description: t.world.home.kicker };
}

const parseNear = (v: string | string[] | undefined) => {
  const n = (typeof v === "string" ? v : "").split(",").map(Number);
  return n.length === 2 && n.every((x) => Number.isFinite(x)) ? { lat: n[0], lng: n[1] } : undefined;
};

/** Where the city the page is about came from. */
type From = "near" | "cookie" | "home" | "biggest";

/** Every section on the front page opens the same way: a gothic kicker in the accent, a poster title. */
function SectionHead({ id, kicker, title }: { id: string; kicker: string; title: React.ReactNode }) {
  return (
    <header>
      <p className="p-gothic text-[1.2rem] leading-tight text-accent">{kicker}</p>
      <h2 id={id} className="p-display mt-1 text-[clamp(2.3rem,11vw,3.6rem)] leading-[0.88] text-bone">
        {title}
      </h2>
    </header>
  );
}

/**
 * The front page of Vanta for the person looking. The issue is the cover:
 * the hero is the magazine, one story at a time. Under it, the search, the
 * guest artists coming to their city, who works near them, what else is in
 * the issue. The city comes from the URL (only if they asked), a cookie,
 * the city on their account, or the biggest city.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const [{ t, locale }, sp, jar, me, cities] = await Promise.all([getDict(), searchParams, cookies(), getClientUser(), listCities("tattoo", 10)]);
  const w = t.world;
  const near = parseNear(sp.near);
  const cookieCity = jar.get(CITY_COOKIE)?.value ?? null;

  // The place the strips are about.
  let current: { slug: string; city: string } | null = null;
  let from: From = "biggest";
  if (near) {
    let best: { slug: string; city: string; km: number } | null = null;
    for (const c of cities) {
      const at = locate(c.city);
      if (!at) continue;
      const km = haversineKm(near.lat, near.lng, at[0], at[1]);
      if (!best || km < best.km) best = { slug: c.slug, city: c.city, km };
    }
    current = best && best.km < 400 ? { slug: best.slug, city: best.city } : null;
    from = "near";
  } else if (cookieCity) {
    current = cities.find((c) => c.slug === cookieCity) ?? { slug: cookieCity, city: cityName(cookieCity) };
    from = "cookie";
  } else if (me?.citySlug) {
    const slug = me.citySlug;
    current = cities.find((c) => c.slug === slug) ?? { slug, city: me.homeCity ?? cityName(slug) };
    from = "home";
  } else if (cities[0]) {
    current = { slug: cities[0].slug, city: cities[0].city };
  }

  const anywhere = near ? { near, days: 45, limit: 8 } : { days: 45, limit: 8 };
  const [issue, nearby, following, spotsFirst] = await Promise.all([
    getIssue(locale),
    near ? searchArtists({ near, sort: "distance" }) : current ? searchArtists({ city: current.slug }) : searchArtists({}),
    me ? followedIds(me.userId) : null,
    upcomingSpots(current ? { city: current.slug, days: 45, limit: 8 } : anywhere),
  ]);
  // Nobody coming to their city: show who is travelling anywhere, and say so.
  const spots = spotsFirst.length || !current ? spotsFirst : await upcomingSpots(anywhere);
  const spotsWhere = !current || !spotsFirst.length ? w.spots.everywhere : from === "home" ? w.spots.inYourCity : fill(w.spots.inCity, { city: current.city });

  const artists = nearby.items.slice(0, 6);
  const place = current ? current.city : w.near.around;
  const followState = (id: string) => (following ? following.has(id) : null);

  const stamp = `${fill(w.issue.number, { n: String(issue.number).padStart(2, "0") })} · ${issueMonth(issue.month, locale)}`;
  const issueHref = `/issue/${issue.number}`;
  const hero = heroStories(issue);
  // Four more chapters, one per byline, leaving out the cover and the piece already on it.
  const byline = new Set<string>();
  const inside = issue.stories
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.kind !== "cover" && s.kind !== "colophon" && s.title && !(s.image && s.image === issue.cover.image))
    .filter(({ s }) => (byline.has(s.kicker) ? false : (byline.add(s.kicker), true)))
    .slice(0, 4);

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": BRAND.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <WorldBar />

      <main className="relative overflow-x-clip pb-16">
        <h1 className="sr-only">
          {BRAND.name} · {BRAND.tagline[locale]}
        </h1>

        {/* The cover. */}
        <IssueHero stories={hero} issueHref={issueHref} stamp={stamp} brand={BRAND.name} coverLines={[...t.issue.cover.lines]} labels={w.hero} />

        <div className="mx-auto w-full max-w-[1280px] px-4">
          {/* The search, right under the cover. */}
          <section className="pt-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-end md:gap-10" aria-label={w.home.search}>
            <div>
              <p className="p-quote text-[clamp(2rem,9vw,3rem)] leading-[1] text-bone">{BRAND.tagline[locale]}</p>
              <p className="p-stamp mt-2 text-bone-dim">{w.home.kicker}</p>
            </div>
            <div className="mt-5 md:mt-0">
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
              <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0" aria-label={w.home.trades}>
                {TRADES.map((tr) => (
                  <li key={tr.slug} className="shrink-0">
                    <Link href={`/explore?trade=${tr.slug}`} className={`chip ${tr.live ? "" : "text-bone-dim"}`} data-active={tr.live} aria-current={tr.live ? "true" : undefined}>
                      {tr.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Guest artists, in the city we think is theirs. */}
          <section className="mt-10" aria-labelledby="home-spots">
            <SectionHead
              id="home-spots"
              kicker={w.spots.lead}
              title={
                <>
                  {w.spots.title} <span className="block text-accent">{spotsWhere}</span>
                </>
              }
            />
            {spots.length === 0 ? (
              <p className="mt-4 text-bone-dim">{fill(w.spots.empty, { city: place })}</p>
            ) : (
              <ul className="-mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {spots.map((s, i) => (
                  <SpotTile key={s.stop.id} spot={s} locale={locale} priority={i < 2} />
                ))}
              </ul>
            )}
            <p className="mt-1 flex items-center justify-between gap-4">
              <a href="#home-near" className="p-stamp inline-flex min-h-11 items-center text-bone-dim underline decoration-bone/30 underline-offset-4 hover:text-bone">
                {w.spots.pickCity}
              </a>
              <Link href="/explore?available=guest" className="p-stamp inline-flex min-h-11 items-center text-bone underline decoration-bone/30 underline-offset-4 hover:decoration-bone">
                {w.spots.all} →
              </Link>
            </p>
          </section>

          {/* Near you. */}
          <section id="home-near" className="mt-10 scroll-mt-4" aria-label={w.near.title}>
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
              <ul className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:px-0 lg:grid-cols-6">
                {artists.map((a, i) => (
                  <li key={a.id} className="w-[62vw] max-w-[16rem] shrink-0 snap-start md:w-auto md:max-w-none">
                    <ArtistCard artist={a} locale={locale} following={followState(a.id)} lead={i === 0} priority={i < 2} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* The rest of the issue. */}
          <section className="mt-10" aria-labelledby="home-issue">
            <SectionHead id="home-issue" kicker={w.issue.kicker} title={w.issue.inThis} />
            <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-8">
              <div className="lg:self-start">
                <IssueCard issue={issue} locale={locale} labels={w.issue} />
              </div>
              <ol className="mt-4 border-t border-line lg:mt-0">
                {inside.map(({ s, n }) => (
                  <li key={s.id} className="border-b border-line">
                    <Link href={`${issueHref}?p=${s.id}`} className="group flex min-h-[5.5rem] items-center gap-4 py-3">
                      <span aria-hidden className="p-display w-8 shrink-0 text-[1.6rem] leading-none text-bone-dim tabular-nums">
                        {String(n).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="p-gothic block truncate text-[1.05rem] leading-tight text-accent">{s.kicker}</span>
                        <span className="p-display mt-0.5 line-clamp-2 block text-[1.55rem] leading-[0.92] text-bone group-hover:underline">{s.title}</span>
                      </span>
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" loading="lazy" decoding="async" className={`h-16 w-12 shrink-0 rounded-[6px] object-cover ${s.pos === "top" ? "object-top" : "object-center"}`} />
                      ) : (
                        <span aria-hidden className="p-stamp w-12 shrink-0 text-center text-bone-dim">
                          →
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* For artists, and the home screen. */}
          <div className="mt-10 flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
            <Link href="/artists" className="group block rounded-[18px] border border-line p-5 transition-colors hover:border-line-strong">
              <p className="p-gothic text-[1.2rem] text-accent">{w.footer.forArtists}</p>
              <p className="p-display mt-1 text-[2rem] text-bone">{t.landing.title}</p>
              <p className="mt-2 text-[0.95rem] text-bone/80">{w.footer.artistsLead}</p>
            </Link>
            <InstallHint labels={w.install} />
          </div>
        </div>
      </main>

      <footer className="relative mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-[0.85rem] text-bone-dim">
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
