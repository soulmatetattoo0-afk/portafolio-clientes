import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { FollowedIssues } from "@/components/world/FollowedIssues";
import { InstallHint } from "@/components/world/InstallHint";
import { issueMonth } from "@/components/world/IssueCard";
import { NearYou } from "@/components/world/NearYou";
import { VantaWord } from "@/components/brand/VantaLogo";
import { BottomTabs } from "@/components/world/BottomTabs";
import { WorldBar } from "@/components/world/WorldBar";
import { ZoneGrid, type ZoneItem } from "@/components/world/ZoneGrid";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND, CITY_COOKIE } from "@/lib/brand";
import { followedIds, getClientUser, unreadChats } from "@/lib/client";
import { cityName, haversineKm, locate } from "@/lib/geo";
import { getIssue } from "@/lib/issue/current";
import { listCities, searchArtists, upcomingSpots } from "@/lib/search";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getDict();
  return { title: { absolute: `${BRAND.name} · ${BRAND.tagline[locale]}` }, description: t.world.home.kicker };
}

const parseNear = (v: string | string[] | undefined) => {
  const n = (typeof v === "string" ? v : "").split(",").map(Number);
  return n.length === 2 && n.every((x) => Number.isFinite(x)) ? { lat: n[0], lng: n[1] } : undefined;
};

/** Every section opens on a folio, as in a magazine: a hairline and a numbered stamp. */
function Folio({ children }: { children: React.ReactNode }) {
  return <p className="p-stamp flex items-center gap-3 border-t border-line pt-3 text-bone-dim">{children}</p>;
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
  if (near) {
    let best: { slug: string; city: string; km: number } | null = null;
    for (const c of cities) {
      const at = locate(c.city);
      if (!at) continue;
      const km = haversineKm(near.lat, near.lng, at[0], at[1]);
      if (!best || km < best.km) best = { slug: c.slug, city: c.city, km };
    }
    current = best && best.km < 400 ? { slug: best.slug, city: best.city } : null;
  } else if (cookieCity) {
    current = cities.find((c) => c.slug === cookieCity) ?? { slug: cookieCity, city: cityName(cookieCity) };
  } else if (me?.citySlug) {
    const slug = me.citySlug;
    current = cities.find((c) => c.slug === slug) ?? { slug, city: me.homeCity ?? cityName(slug) };
  } else if (cities[0]) {
    // With nothing to go on, New York (where VANTA starts), else the biggest city.
    const start = cities.find((c) => c.slug === "new-york") ?? cities[0];
    current = { slug: start.slug, city: start.city };
  }

  const anywhere = near ? { near, days: 45, limit: 8 } : { days: 45, limit: 8 };
  const [issue, nearby, following, spotsFirst] = await Promise.all([
    getIssue(locale),
    near ? searchArtists({ near, sort: "distance" }) : current ? searchArtists({ city: current.slug }) : searchArtists({}),
    me ? followedIds(me.userId) : null,
    upcomingSpots(current ? { city: current.slug, days: 45, limit: 8 } : anywhere),
  ]);
  // Nobody coming to their city: show who is travelling anywhere, and say so.
  const place = current ? current.city : w.near.around;

  // Their zone: visitors first (soonest first), then the residents, nobody twice.
  const visiting = spotsFirst.map((sp) => ({ artist: { ...sp.artist, next_stop: sp.stop }, kind: "visit" as const }));
  const seen = new Set(visiting.map((z) => z.artist.id));
  const zone: ZoneItem[] = [...visiting, ...nearby.items.filter((a) => !seen.has(a.id)).slice(0, 8).map((a) => ({ artist: a, kind: "resident" as const }))];
  const unread = me ? await unreadChats(me.userId) : 0;
  const v = w.v2;

  const stamp = `${fill(w.issue.number, { n: String(issue.number).padStart(2, "0") })} · ${issueMonth(issue.month, locale)}`;
  const issueHref = `/issue/${issue.number}`;
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
        {/* A message waiting gets the first line of the page. */}
        {unread > 0 && (
          <Link href="/me/briefs" className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-accent/60 bg-ink-2 px-4 py-3 text-bone">
            <span className="flex items-center gap-2.5 text-[0.95rem]">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              {fill(unread === 1 ? v.unreadOne : v.unreadMany, { n: unread })}
            </span>
            <span className="p-stamp text-[0.6rem]">{v.seeChats} →</span>
          </Link>
        )}

        {/* 01 · VANTA's news first: the issue, on paper. */}
        <section id="home-issue" className="scroll-mt-4 bg-bone text-ink" aria-labelledby="home-issue-h">
          <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-12 md:py-16">
            <p className="p-stamp flex items-center justify-between gap-3 border-t border-ink/25 pt-3 text-ink/60">
              <span>{v.folioIssue}</span>
              <span>{me?.name ? fill(v.edition, { name: me.name }) : stamp}</span>
            </p>
            <h2 id="home-issue-h" className="p-display mt-3 text-[clamp(2.3rem,11vw,3.6rem)] leading-[0.88]">
              {v.issueTitle}
            </h2>
            <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
              <Link href={issueHref} className="relative mx-auto block aspect-[3/4] w-[70vw] max-w-sm overflow-hidden rounded-[2px] bg-ink text-bone shadow-[0_30px_50px_-24px_rgb(0_0_0/0.6)] lg:mx-0 lg:w-full">
                {issue.cover.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={issue.cover.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />
                <span className="absolute inset-x-4 top-4">
                  <VantaWord className="h-[1.1rem] w-auto" />
                  <span className="p-stamp mt-2 flex items-center gap-2 border-t border-bone/40 pt-2 text-[0.58rem] text-bone/80">{stamp}</span>
                </span>
                <span className="p-display absolute inset-x-4 bottom-4 text-[clamp(1.8rem,8vw,2.6rem)] leading-[0.9]">{t.issue.cover.lines[0]}</span>
              </Link>
              <div className="mt-8 lg:mt-0">
                <ol className="border-t border-ink/20">
                  {inside.map(({ s: story, n }) => (
                    <li key={story.id} className="border-b border-ink/20">
                      <Link href={`${issueHref}?p=${story.id}`} className="group flex min-h-[5.5rem] items-center gap-4 py-3">
                        <span aria-hidden className="p-display w-8 shrink-0 text-[1.6rem] leading-none text-ink/40 tabular-nums">
                          {String(n).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="p-stamp block truncate text-[0.6rem] text-ink/60">{story.kicker}</span>
                          <span className="p-display mt-1 line-clamp-2 block text-[1.55rem] leading-[0.92] group-hover:underline">{story.title}</span>
                        </span>
                        {story.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={story.image} alt="" loading="lazy" decoding="async" className={`h-16 w-12 shrink-0 rounded-[2px] object-cover ${story.pos === "top" ? "object-top" : "object-center"}`} />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link href={issueHref} className="btn mt-6 bg-ink text-bone hover:bg-ink/85">
                  {v.readIssue} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1280px] px-4">
          {/* 02 · The shelf: saved artists' magazines with what's new on each (or covers to start with). */}
          <FollowedIssues userId={me?.userId ?? null} citySlug={current?.slug ?? null} t={t} locale={locale} folio={<Folio>{v.folioShelf}</Folio>} />

          {/* 03 · Their zone: visitors and residents in one grid. */}
          <section id="home-near" className="mt-16 scroll-mt-4 md:mt-24" aria-labelledby="home-zone">
            <Folio>{v.folioZone}</Folio>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <h2 id="home-zone" className="p-display text-[clamp(2.3rem,11vw,3.6rem)] leading-[0.88] text-bone">
                {v.zoneTitle}
                <span className="block text-[0.55em] text-bone-dim">{place}</span>
              </h2>
              <details className="group relative">
                <summary className="chip cursor-pointer list-none [&::-webkit-details-marker]:hidden">{v.changeCity} ▾</summary>
                <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[16px] border border-line bg-ink-2 p-4 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)]">
                  <NearYou
                    title={w.near.title}
                    place={place}
                    current={current?.slug ?? null}
                    located={Boolean(near)}
                    cities={cities}
                    labels={{ cities: w.near.cities, useLocation: w.near.useLocation, locating: w.near.locating, denied: w.near.denied, seeAll: fill(w.near.seeAll, { city: current?.city ?? "" }) }}
                  />
                </div>
              </details>
            </div>
            {zone.length === 0 ? (
              <p className="mt-4 text-bone-dim">{fill(v.zoneEmpty, { city: place })}</p>
            ) : (
              <ZoneGrid
                items={zone}
                locale={locale}
                following={following ? [...following] : null}
                labels={{ all: v.zoneAll, visit: v.zoneVisit, resident: v.zoneResident, filter: v.zoneFilter }}
              />
            )}
            <p className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              {current && (
                <Link href={`/city/${current.slug}`} className="p-stamp inline-flex min-h-11 items-center text-bone underline decoration-bone/30 underline-offset-4 hover:decoration-bone">
                  {fill(v.seeAllIn, { city: current.city })} →
                </Link>
              )}
              <Link href="/explore" className="p-stamp inline-flex min-h-11 items-center text-bone-dim underline decoration-bone/30 underline-offset-4 hover:text-bone">
                {v.discover} →
              </Link>
            </p>
          </section>
        </div>

        <div className="mx-auto w-full max-w-[1280px] px-4">
          {/* For artists, and the home screen. */}
          <div className="mt-12 flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
            <Link href="/artists" className="group block rounded-[18px] border border-line p-5 transition-colors hover:border-line-strong">
              <p className="p-stamp text-bone-dim">{w.footer.forArtists}</p>
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
      <BottomTabs />
    </div>
  );
}
