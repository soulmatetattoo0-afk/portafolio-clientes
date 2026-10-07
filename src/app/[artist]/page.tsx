import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBanner, PublicBar } from "@/components/Chrome";
import { PolicyList } from "@/components/Policy";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { dateRange, money } from "@/lib/format";
import { getArtistBySlug, listPortfolio, listStops } from "@/lib/queries";

import { PortfolioGrid } from "./PortfolioGrid";
import { Waitlist } from "./Waitlist";

export async function generateMetadata({ params }: PageProps<"/[artist]">): Promise<Metadata> {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return {};
  return { title: artist.display_name, description: artist.headline ?? undefined };
}

export default async function ArtistPage({ params }: PageProps<"/[artist]">) {
  const { artist: slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  const [{ t, locale }, stops, portfolio] = await Promise.all([getDict(), listStops(artist.id, { publicOnly: true }), listPortfolio(artist.id, { publishedOnly: true })]);
  const a = t.artist;
  const cta = artist.accepting ? a.cta : a.ctaClosed;
  const ctaHref = artist.accepting ? `/${artist.slug}/request` : "#cities";

  return (
    <>
      <DemoBanner />
      <PublicBar>
        <span className="t-inscription truncate text-[0.82rem] tracking-[0.24em] text-gilt">{artist.display_name.toUpperCase()}</span>
      </PublicBar>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 sm:px-6 sm:pb-20">
        <section className="grid gap-6 border-b border-line pt-10 pb-12 sm:pt-16 sm:pb-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <h1 className="t-inscription text-[clamp(2.6rem,9vw,5.6rem)] break-words">{artist.display_name}</h1>
            {artist.headline && <p className="mt-4 max-w-[34ch] font-serif text-[clamp(1.35rem,3vw,1.75rem)] leading-snug text-vellum/90 italic">{artist.headline}</p>}
          </div>
          <div className="grid gap-5 lg:justify-items-start">
            <dl className="grid gap-1 text-[0.95rem]">
              {artist.home_city && (
                <div>
                  <dt className="sr-only">{a.home}</dt>
                  <dd>{fill(a.basedIn, { city: artist.home_city })}</dd>
                </div>
              )}
              {artist.instagram && (
                <div>
                  <dt className="sr-only">Instagram</dt>
                  <dd>
                    <a className="link" href={`https://instagram.com/${artist.instagram}`} rel="noopener noreferrer" target="_blank">
                      @{artist.instagram}
                    </a>
                  </dd>
                </div>
              )}
              {artist.min_price_cents ? (
                <div>
                  <dt className="sr-only">{a.startingAt}</dt>
                  <dd className="text-ash">{fill(a.startingAt, { price: money(artist.min_price_cents, artist.currency, locale) })}</dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap items-center gap-4">
              <Link href={ctaHref} className="btn btn-primary min-w-48">
                {cta}
              </Link>
              <span className={`pill ${artist.accepting ? "text-verdigris" : "text-ember"}`}>{artist.accepting ? a.booksOpen : a.booksClosed}</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="work" className="py-12 sm:py-16">
          <h2 id="work" className="t-title mb-6">
            {a.work}
          </h2>
          <PortfolioGrid items={portfolio} locale={locale} labels={{ all: a.allStyles, healed: a.healed, empty: a.noWork }} />
        </section>

        {stops.length > 0 && (
          <section id="cities" aria-labelledby="cities-title" className="scroll-mt-6 border-t border-line py-12 sm:py-16">
            <h2 id="cities-title" className="t-title mb-6">
              {a.cities}
            </h2>
            <ul className="divide-y divide-line border-y border-line">
              {stops.map((s) => (
                <li key={s.id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
                  <div className="min-w-0">
                    <p className="font-serif text-[1.55rem] leading-tight">
                      {s.city}
                      <span className="text-ash">, {s.country}</span>
                    </p>
                    <p className="mt-1 text-[0.92rem] text-ash">{[s.studio_name, s.is_home ? a.home : dateRange(s.starts_on, s.ends_on, locale)].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className={`pill ${s.status === "booking" ? "text-verdigris" : s.status === "full" ? "text-ember" : "text-ash"}`}>{a.status[s.status]}</span>
                    {(s.status === "announced" || s.status === "full") && (
                      <Waitlist
                        artistId={artist.id}
                        stopId={s.id}
                        city={s.city}
                        labels={{
                          notify: a.notifyMe,
                          title: fill(a.waitlistTitle, { city: s.city }),
                          email: a.waitlistEmail,
                          join: fill(a.waitlistJoin, { city: s.city }),
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="how" className="grid gap-10 border-t border-line py-12 sm:py-16 lg:grid-cols-2">
          <div>
            <h2 id="how" className="t-title mb-6">
              {a.howTitle}
            </h2>
            <ol className="grid gap-6">
              {a.how.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                  <span className="font-serif text-[1.6rem] leading-none text-gilt">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-ash">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="t-heading mb-5">{a.policyTitle}</h2>
            <PolicyList policy={artist.deposit_policy} t={t} />
            {artist.bio && <p className="mt-10 max-w-[60ch] font-serif text-[1.2rem] leading-relaxed text-vellum/85">{artist.bio}</p>}
          </div>
        </section>
      </main>

      {/* Phones arrive from Instagram: keep the main action under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-soot/92 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:hidden">
        <Link href={ctaHref} className="btn btn-primary w-full">
          {cta}
        </Link>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-28 text-[0.8rem] text-ash-dim sm:px-6 sm:pb-10">
        <Link href="/" className="hover:text-ash">
          Brief
        </Link>
      </footer>
    </>
  );
}
