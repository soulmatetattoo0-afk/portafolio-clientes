import type { Metadata } from "next";
import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { getArtistBySlug, listArtists } from "@/lib/queries";

import { ExploreGate } from "./ExploreGate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.explore.title, description: t.explore.lead };
}

/**
 * The world outside one artist's page: search, kinds, cities. On the web it
 * shows through a dark vignette with one way forward, the app; installed,
 * it opens in full.
 */
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const [{ t, locale }, artists, sp] = await Promise.all([getDict(), listArtists(), searchParams]);
  const x = t.explore;
  const from = typeof sp.from === "string" ? await getArtistBySlug(sp.from) : null;
  const city = artists[0]?.home_city ?? "New York";
  const soon = [
    { kind: x.kinds.barber, n: 1 },
    { kind: x.kinds.tattoo, n: 2 },
    { kind: x.kinds.graffiti, n: 3 },
    { kind: x.kinds.barber, n: 4 },
    { kind: x.kinds.tattoo, n: 5 },
  ];

  return (
    <div className="poster relative min-h-dvh">
      <div className="p-grain" aria-hidden />
      <header className="relative z-20 flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),0.9rem)]">
        {from ? (
          <Link href={`/${from.slug}#deck`} className="p-stamp flex items-center gap-2 py-2 text-bone">
            <span aria-hidden className="text-[1.2rem] leading-none">←</span>
            {from.display_name.toUpperCase()}
          </Link>
        ) : (
          <span className="p-stamp text-bone">BRIEF</span>
        )}
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>

      <ExploreGate labels={{ title: x.gateTitle, body: x.gateBody, install: x.gateInstall, installing: x.gateInstalling, later: x.gateLater, back: from ? { label: x.gateBack.replace("{artist}", from.display_name), href: `/${from.slug}#deck` } : null }}>
        <main className="relative px-5 pt-6 pb-24">
          <p className="p-gothic text-[1.3rem] text-accent">{x.title}</p>
          <h1 className="p-display mt-1 text-[clamp(3rem,15vw,6rem)] text-bone">{x.lead.split(",")[0]}</h1>
          <p className="mt-2 max-w-[40ch] text-bone/80">{x.lead}</p>

          <label className="mt-6 flex items-center gap-3 rounded-full border border-line-strong bg-ink-2 px-4 py-3">
            <span aria-hidden className="text-bone-dim">⌕</span>
            <span className="sr-only">{x.search}</span>
            <input className="w-full bg-transparent text-bone outline-none placeholder:text-bone-dim" placeholder={x.search} />
          </label>

          <div className="mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="chip shrink-0" data-active="true">
              {x.all}
            </span>
            {Object.values(x.kinds).map((k) => (
              <span key={k} className="chip shrink-0">
                {k}
              </span>
            ))}
          </div>

          <section className="mt-8" aria-label={x.near}>
            <div className="flex items-baseline justify-between">
              <h2 className="p-display text-[2.2rem]">{city}</h2>
              <span className="p-stamp text-bone-dim">{x.near}</span>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {artists.map((a) => (
                <li key={a.slug} className="relative aspect-[3/4] overflow-hidden rounded-[16px] border border-line bg-ink-2" style={{ ["--accent" as string]: a.accent ?? "#d8552f" }}>
                  {a.portrait_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.portrait_url} alt="" className="absolute inset-0 h-full w-full object-cover object-top grayscale" />
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                  <div className="absolute right-3 bottom-3 left-3">
                    <p className="p-display text-[1.5rem] leading-[0.95]">{a.display_name}</p>
                    <p className="mt-1 truncate text-[0.78rem] text-bone/75">{a.styles.map((st) => STYLE_BY_SLUG.get(st)?.label[locale] ?? st).join(" · ")}</p>
                  </div>
                  <span className="p-stamp absolute top-3 left-3 rounded-full bg-accent px-2 py-0.5 text-[0.55rem] text-ink">{x.kinds.tattoo}</span>
                </li>
              ))}
              {soon.map((s) => (
                <li key={s.n} className="relative aspect-[3/4] overflow-hidden rounded-[16px] border border-dashed border-line-strong bg-ink-2">
                  <span aria-hidden className="p-gothic absolute -top-2 right-2 text-[6rem] leading-none text-bone/[0.07]">
                    {String(s.n).padStart(2, "0")}
                  </span>
                  <div className="absolute right-3 bottom-3 left-3">
                    <p className="p-stamp text-bone-dim">{s.kind}</p>
                    <p className="p-quote text-[1.2rem] text-bone/70">{x.soon}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </ExploreGate>
    </div>
  );
}
