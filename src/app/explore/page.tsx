import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { ArtistCard } from "@/components/world/ArtistCard";
import { Filters } from "@/components/world/Filters";
import { FollowCity } from "@/components/world/FollowCity";
import { SortChips } from "@/components/world/SortChips";
import { BottomTabs } from "@/components/world/BottomTabs";
import { WorldBar } from "@/components/world/WorldBar";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND, CITY_COOKIE } from "@/lib/brand";
import { COUNTRIES, STYLES, STYLE_BY_SLUG, TRADES, TRADE_BY_SLUG } from "@/lib/catalog";
import { followedCities, followedIds, getClientUser } from "@/lib/client";
import { money, requestTime } from "@/lib/format";
import { cityName, citySlug } from "@/lib/geo";
import { getArtistBySlug } from "@/lib/queries";
import { listCities, parseSearch, searchArtists, type SearchParams } from "@/lib/search";

const PAGE = 24;
const PRICES = [15000, 30000, 60000, 100000];

export async function generateMetadata({ searchParams }: PageProps<"/explore">): Promise<Metadata> {
  const [{ t }, sp] = await Promise.all([getDict(), searchParams]);
  const p = parseSearch(sp);
  const bits = [p.q, p.city ? cityName(p.city) : null].filter(Boolean).join(" · ");
  return { title: bits ? `${t.search.title} · ${bits}` : t.search.title, description: t.explore.lead };
}

const DAY = 86400000;

/**
 * The search. Everything is in the URL: the query, the filters, the sort,
 * the page. The server finds, ranks and, when nothing matches, loosens the
 * filters and says what it dropped.
 */
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const [{ t, locale }, sp, jar, me] = await Promise.all([getDict(), searchParams, cookies(), getClientUser()]);
  const x = t.search;
  const now = requestTime();
  const p = parseSearch(sp);
  const trade = TRADE_BY_SLUG.get(p.trade ?? "tattoo")!;
  const from = typeof sp.from === "string" ? await getArtistBySlug(sp.from) : null;
  const [cities, following, followedCitySet] = await Promise.all([listCities("tattoo", 12), me ? followedIds(me.userId) : null, me ? followedCities(me.userId) : null]);
  const result = trade.live ? await searchArtists(p) : null;
  const styleLabel = (s: string) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s;
  const cityLabel = p.city ? (cities.find((c) => c.slug === p.city)?.city ?? cityName(p.city)) : (cities.find((c) => c.slug === jar.get(CITY_COOKIE)?.value)?.city ?? cities[0]?.city ?? "");
  const followState = (slug: string) => (followedCitySet ? followedCitySet.has(slug) : null);

  // The reason a card is here, in words: what it shares with the search.
  const why = (a: (typeof items)[number]): string | undefined => {
    const bits: string[] = [];
    const shared = (p.styles ?? []).filter((s) => a.styles.includes(s));
    if (shared.length) bits.push(shared.map(styleLabel).join(", "));
    const stop = a.next_stop;
    if (p.city && stop?.city_slug === p.city && stop.starts_on) {
      const days = Math.round((new Date(`${stop.starts_on}T00:00:00Z`).getTime() - now) / DAY);
      bits.push(fill(days <= 7 ? t.world.card.nextWeek : days <= 31 ? t.world.card.thisMonth : t.world.card.soon, { city: stop.city }));
    } else if (p.city && a.city_slug === p.city && a.home_city) bits.push(fill(t.world.card.based, { city: a.home_city }));
    if (p.healed && a.has_healed) bits.push(x.why.healed);
    if (p.color === "color" && a.has_color) bits.push(x.why.colour);
    if (p.color === "black_grey" && a.has_black_grey) bits.push(x.why.blackGrey);
    if (p.available === "now" && a.accepting) bits.push(x.why.accepting);
    if (p.near && p.sort === "distance" && a.distance_km != null) bits.push(fill(x.why.near, { km: Math.round(a.distance_km) }));
    return bits.length ? bits.slice(0, 3).join(" · ") : undefined;
  };
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") q.set(k, v);
    if (n > 0) q.set("page", String(n));
    const s = q.toString();
    return `/explore${s ? `?${s}` : ""}`;
  };

  // What the relaxed search let go of.
  const dropped = result?.relaxed ?? [];
  const what = [...(dropped.includes("styles") ? (p.styles ?? []).map(styleLabel) : []), ...(dropped.includes("color") ? [p.color === "color" ? x.filters.color : p.color === "black_grey" ? x.filters.blackGrey : null, p.healed ? x.filters.healed : null].filter(Boolean) : [])].join(", ");
  const where = dropped.includes("city") ? cityLabel : null;
  const relaxedTitle = where && what ? fill(x.relaxed.cityAndWhat, { city: where, what }) : where ? fill(x.relaxed.city, { city: where }) : what ? fill(x.relaxed.what, { what }) : null;
  const hidden: [string, string | undefined][] = [
    ["trade", p.trade],
    ["styles", p.styles?.join(",") || undefined],
    ["city", p.city],
    ["color", p.color],
    ["healed", p.healed ? "1" : undefined],
    ["available", p.available],
    ["priceMax", p.priceMax ? String(p.priceMax) : undefined],
    ["sort", p.sort !== "match" ? p.sort : undefined],
    ["near", p.near ? `${p.near.lat},${p.near.lng}` : undefined],
  ];

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": BRAND.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <WorldBar back={from ? { href: `/${from.slug}#deck`, label: from.display_name } : null} search={false} next="/explore" />

      <main className="relative mx-auto w-full max-w-[1280px] px-4 pt-4 pb-20">
        <h1 className="p-display text-[clamp(3.2rem,16vw,6rem)] text-bone">{x.title}</h1>

        <form action="/explore" method="get" role="search" className="mt-3 flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 py-1.5 pr-1.5 pl-4 focus-within:border-bone">
          {hidden.map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <label className="sr-only" htmlFor="q">
            {x.submit}
          </label>
          <input id="q" name="q" type="search" enterKeyHint="search" maxLength={80} defaultValue={p.q ?? ""} className="min-w-0 flex-1 bg-transparent py-2 text-[1rem] text-bone outline-none placeholder:text-bone-dim" placeholder={x.placeholder} />
          <button type="submit" className="btn btn-primary btn-sm">
            {x.submit}
          </button>
        </form>

        <div className="mt-4">
          <Filters
            state={{ trade: p.trade ?? "tattoo", styles: p.styles ?? [], city: p.city, color: p.color, healed: Boolean(p.healed), available: p.available, priceMax: p.priceMax }}
            options={{
              trades: TRADES.map((tr) => ({ slug: tr.slug, label: tr.plural[locale], live: tr.live })),
              styles: STYLES.filter((s) => s.slug !== "other").map((s) => ({ slug: s.slug, label: s.label[locale] })),
              cities: cities.map((c) => ({ slug: c.slug, city: c.city })),
              countries: COUNTRIES.map((c) => ({ code: c.code, label: c.label[locale], cities: c.cities.map((city) => ({ slug: citySlug(city), city })) })),
              prices: PRICES.map((cents) => ({ cents, label: fill(x.filters.upTo, { price: money(cents, "usd", locale) }) })),
            }}
            labels={{ ...x.filters, any: t.explore.all }}
          />
        </div>

        {!trade.live ? (
          <section className="mt-8 rounded-[18px] bg-bone px-5 py-6 text-ink" aria-live="polite">
            <p className="p-gothic text-[1.2rem] text-ink/70">{trade.label[locale]}</p>
            <h2 className="p-display mt-1 text-[clamp(2.4rem,11vw,4rem)] leading-[0.9]">{fill(x.coming.title, { trade: trade.plural[locale] })}</h2>
            <p className="mt-3 max-w-[40ch] text-[0.95rem] text-ink/85">{fill(x.coming.body, { city: cityLabel })}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <FollowCity
                city={p.city ?? cityLabel}
                trade={trade.slug}
                following={followState(p.city ?? cityLabel)}
                labels={{ follow: fill(x.coming.follow, { trade: trade.plural[locale], city: cityLabel }), following: fill(x.coming.following, { trade: trade.plural[locale], city: cityLabel }) }}
              />
              <Link href="/artists" className="btn btn-ghost text-ink underline decoration-ink/30 underline-offset-4">
                {x.coming.send}
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="p-stamp text-bone-dim" aria-live="polite">
                {total === 1 ? x.count.one : fill(x.count.many, { n: total })}
                {pages > 1 ? ` · ${fill(x.count.page, { n: (p.page ?? 0) + 1, total: pages })}` : ""}
              </p>
              <SortChips sort={p.sort ?? "match"} hasNear={Boolean(p.near)} labels={x.sort} />
            </div>

            {relaxedTitle && (
              <section className="mt-4 rounded-[18px] bg-bone px-5 py-5 text-ink" aria-live="polite">
                <h2 className="p-display text-[clamp(1.8rem,8vw,2.6rem)] leading-[0.9]">{relaxedTitle}</h2>
                <p className="p-quote mt-2 text-[1.3rem] text-ink/80">{x.relaxed.lead}</p>
                {where && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <FollowCity city={p.city!} following={followState(p.city!)} labels={{ follow: fill(x.relaxed.follow, { city: where }), following: fill(x.relaxed.following, { city: where }) }} />
                    <Link href="/artists" className="btn btn-ghost text-ink underline decoration-ink/30 underline-offset-4">
                      {fill(x.relaxed.send, { city: where })}
                    </Link>
                  </div>
                )}
              </section>
            )}

            {items.length === 0 ? (
              <section className="mt-8">
                <h2 className="p-display text-[2.4rem] text-bone">{x.empty.title}</h2>
                <p className="mt-2 max-w-[40ch] text-bone/80">{x.empty.body}</p>
                <Link href="/explore" className="btn btn-secondary mt-4">
                  {x.filters.clear}
                </Link>
              </section>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {items.map((a, i) => (
                  <li key={a.id}>
                    <ArtistCard artist={a} locale={locale} following={following ? following.has(a.id) : null} why={why(a)} lead={i === 0 && (p.page ?? 0) === 0 && (p.sort ?? "match") === "match"} priority={i < 4} />
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav className="mt-8 flex items-center justify-between gap-3" aria-label={x.count.page}>
                {(p.page ?? 0) > 0 ? (
                  <Link href={pageHref((p.page ?? 0) - 1)} className="btn btn-secondary">
                    ← {x.prev}
                  </Link>
                ) : (
                  <span />
                )}
                {(p.page ?? 0) + 1 < pages && (
                  <Link href={pageHref((p.page ?? 0) + 1)} className="btn btn-secondary">
                    {x.next} →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </main>
      <BottomTabs />
    </div>
  );
}

export type { SearchParams };
