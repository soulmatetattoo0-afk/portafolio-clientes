import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { FollowedIssues } from "@/components/world/FollowedIssues";
import { HomeMotion } from "@/components/world/HomeMotion";
import { HowItWorks } from "@/components/world/HowItWorks";
import { InstallHint } from "@/components/world/InstallHint";
import { issueMonth } from "@/components/world/IssueCard";
import { IssueFront } from "@/components/world/IssueFront";
import { NearYou } from "@/components/world/NearYou";
import { Ticker } from "@/components/world/Ticker";
import { BottomTabs } from "@/components/world/BottomTabs";
import { WorldBar } from "@/components/world/WorldBar";
import { ZoneGrid, type ZoneItem } from "@/components/world/ZoneGrid";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND, CITY_COOKIE } from "@/lib/brand";
import { followedIds, getClientUser, unreadChats } from "@/lib/client";
import { getDb } from "@/lib/db";
import { cityName, haversineKm, locate } from "@/lib/geo";
import { getIssue } from "@/lib/issue/current";
import { listCities, searchArtists, upcomingSpots } from "@/lib/search";

/** The VANTA world's front page, parked while VANTA runs as each artist's own app (decision 29). */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getDict();
  return { title: { absolute: `${BRAND.name} · ${BRAND.tagline[locale]}` }, description: t.world.home.kicker, robots: { index: false } };
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
export default async function Home({ searchParams }: PageProps<"/lab/vanta">) {
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
  const [issue, nearby, following, spotsFirst, fresh] = await Promise.all([
    getIssue(locale),
    near ? searchArtists({ near, sort: "distance" }) : current ? searchArtists({ city: current.slug }) : searchArtists({}),
    me ? followedIds(me.userId) : null,
    upcomingSpots(current ? { city: current.slug, days: 45, limit: 8 } : anywhere),
    (await getDb()).query<{ id: string }>(`select id from artists where listed and created_at > now() - interval '30 days'`),
  ]);
  const arrived = new Set(fresh.map((f) => f.id));
  // Nobody coming to their city: show who is travelling anywhere, and say so.
  const place = current ? current.city : w.near.around;

  // Their zone: visitors first (soonest first), then the residents, nobody twice.
  const visiting = spotsFirst.map((sp) => ({ artist: { ...sp.artist, next_stop: sp.stop }, kind: "visit" as const }));
  const seen = new Set(visiting.map((z) => z.artist.id));
  const zone: ZoneItem[] = [...visiting, ...nearby.items.filter((a) => !seen.has(a.id)).slice(0, 8).map((a) => ({ artist: a, kind: "resident" as const }))].map((z) => ({ ...z, isNew: arrived.has(z.artist.id) }));
  const unread = me ? await unreadChats(me.userId) : 0;
  const v = w.v2;

  const stamp = `${fill(w.issue.number, { n: String(issue.number).padStart(2, "0") })} · ${issueMonth(issue.month, locale)}`;
  const issueHref = `/issue/${issue.number}`;
  // Four chapters from inside: the news and the people, one per section.
  const byline = new Set<string>();
  const inside = issue.stories
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.kind === "news" || s.kind === "feature" || s.kind === "piece")
    .filter(({ s }) => (byline.has(s.kicker) ? false : (byline.add(s.kicker), true)))
    .slice(0, 4);

  const h = w.front;
  const featured = zone.find((z) => z.artist.slug === "sova")?.artist ?? zone[0]?.artist ?? null;
  const visitingCount = zone.filter((z) => z.kind === "visit").length;
  const residentCount = zone.length - visitingCount;
  const headlines = issue.stories.filter((s) => s.kind === "news" || s.kind === "feature").map((s) => (s.place ? `${s.place} — ${s.title}` : s.title));

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": BRAND.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <div className="relative z-30">
        <WorldBar />
      </div>

      <main className="relative overflow-x-clip pb-16">
        <h1 className="sr-only">
          {BRAND.name} · {BRAND.tagline[locale]}
        </h1>

        {/* 01 · The issue is the front page: the cover, the title, the contents. */}
        <IssueFront
          image={issue.cover.image}
          pos={issue.cover.pos}
          title={issue.title}
          lead={issue.lead}
          stamp={stamp}
          href={issueHref}
          inside={inside.map(({ s, n }) => ({ story: s, n }))}
          labels={{ kicker: h.issueKicker, contents: h.issueContents, read: v.readIssue, open: h.issueOpen, folio: h.folioIssue }}
        />

        {/* A message waiting gets the first line after the cover. */}
        {unread > 0 && (
          <Link href="/me/briefs" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-accent/60 bg-ink-2 px-4 py-3 text-bone">
            <span className="flex items-center gap-2.5 text-[0.95rem]">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              {fill(unread === 1 ? v.unreadOne : v.unreadMany, { n: unread })}
            </span>
            <span className="p-stamp text-[0.6rem]">{v.seeChats} →</span>
          </Link>
        )}

        {/* The headlines run under the cover like a news strip. */}
        <div className="mt-6">
          <Ticker items={[`${BRAND.name} · ${stamp}`, ...headlines]} label={h.tickerLabel} href={issueHref} />
        </div>

        <div className="mx-auto w-full max-w-[1280px] px-4">
          {/* 02 · The shelf: saved artists' magazines with what's new on each (or covers to start with). */}
          <FollowedIssues userId={me?.userId ?? null} citySlug={current?.slug ?? null} t={t} locale={locale} folio={<Folio>{h.folioShelf}</Folio>} />
        </div>

        {/* 03 · Their city, on paper: who is passing through and who lives here, the city set huge behind. */}
        <section id="home-near" className="relative mt-16 scroll-mt-4 overflow-hidden bg-bone text-ink md:mt-24" aria-labelledby="home-zone">
          <span aria-hidden data-parallax className="p-display pointer-events-none absolute -top-[0.1em] -right-[0.08em] text-[min(42vw,22rem)] leading-[0.8] whitespace-nowrap text-ink opacity-[0.06] select-none">
            {place}
          </span>
          <div className="relative mx-auto w-full max-w-[1280px] px-4 py-12 md:py-16">
            <p className="p-stamp flex items-center gap-3 border-t border-ink/25 pt-3 text-ink/60">{h.folioCity}</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div data-reveal>
                <h2 id="home-zone" className="p-display text-[clamp(2.6rem,13vw,5rem)] leading-[0.86] text-ink">
                  {fill(h.todayIn, { city: place })}
                </h2>
                <p className="p-quote mt-2 text-[clamp(1.1rem,4.4vw,1.45rem)] text-ink/75">{fill(h.todayCount, { visiting: visitingCount, residents: residentCount })}</p>
              </div>
              <details className="group relative">
                <summary className="chip cursor-pointer list-none border-ink/40 text-ink [&::-webkit-details-marker]:hidden">{v.changeCity} ▾</summary>
                <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[16px] border border-line bg-ink-2 p-4 text-bone shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)]">
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
              <p className="mt-4 text-ink/70">{fill(h.todayNone, { city: place })}</p>
            ) : (
              <ZoneGrid
                items={zone}
                locale={locale}
                following={following ? [...following] : null}
                labels={{ all: v.zoneAll, visit: v.zoneVisit, resident: v.zoneResident, filter: v.zoneFilter, isNew: h.newBadge }}
              />
            )}
            <p className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              {current && (
                <Link href={`/city/${current.slug}`} className="p-stamp inline-flex min-h-11 items-center text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                  {fill(v.seeAllIn, { city: current.city })} →
                </Link>
              )}
              <Link href="/explore" className="p-stamp inline-flex min-h-11 items-center text-ink/70 underline decoration-ink/30 underline-offset-4 hover:text-ink">
                {v.discover} →
              </Link>
            </p>
          </div>
        </section>

        {/* 04 · The guide: three steps from the magazine to the chair. */}
        <HowItWorks
          folio={h.folioHow}
          title={h.howTitle}
          lead={h.howLead}
          steps={h.steps.map((st, i) => ({ ...st, href: i === 0 ? "/explore" : i === 1 ? (featured ? `/${featured.slug}` : "/explore") : featured ? `/${featured.slug}/request` : "/explore" }))}
        />

        {/* The invitation: artists build their own VANTA. */}
        <section className="mx-auto mt-14 w-full max-w-[1280px] px-4" data-reveal>
          <Link href="/login?mode=create" className="group relative block overflow-hidden rounded-[28px] p-6 sm:p-10" style={{ background: "var(--accent, #c8231e)" }}>
            <div className="p-halftone" />
            <p className="p-stamp relative text-bone/80">{t.join.stamp}</p>
            <p className="p-display relative mt-2 text-[clamp(2.6rem,11vw,6rem)] leading-[0.86] text-bone">{t.join.title}</p>
            <p className="relative mt-3 max-w-[46ch] text-[1.05rem] text-bone/90">{t.join.lead}</p>
            <span className="relative mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-ink px-6 font-semibold text-bone transition-transform group-hover:translate-x-1">
              {t.join.cta} <span aria-hidden>→</span>
            </span>
          </Link>
        </section>

        <div className="mx-auto w-full max-w-[1280px] px-4">
          {/* For artists, and the home screen. */}
          <div className="mt-12 flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start" data-reveal-group>
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
      <HomeMotion />
    </div>
  );
}
