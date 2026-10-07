import Link from "next/link";

import { DemoBanner, Wordmark } from "@/components/Chrome";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";

import { AccessForm } from "./AccessForm";
import { HeroFigure } from "./HeroFigure";

export default async function Home() {
  const { t, locale } = await getDict();
  const l = t.landing;
  return (
    <>
      <DemoBanner />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 sm:px-6">
        <Link href="/" className="py-2">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <a href="#pricing" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            {l.nav.pricing}
          </a>
          <Link href="/login" className="btn btn-ghost btn-sm">
            {l.nav.signIn}
          </Link>
          <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="grid gap-10 pt-8 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-24">
          <div className="min-w-0">
            <h1 className="t-display max-w-[13ch] text-[clamp(2.6rem,7vw,4.6rem)]">{l.title}</h1>
            <p className="t-lead mt-6 max-w-[52ch]">{l.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#access" className="btn btn-primary">
                {l.ctaAccess}
              </a>
              <Link href="/iris" className="btn btn-secondary">
                {l.ctaDemo}
              </Link>
            </div>
          </div>
          <HeroFigure locale={locale} caption={l.figureCaption} />
        </section>

        <section aria-labelledby="steps" className="border-t border-line py-16 sm:py-20">
          <h2 id="steps" className="t-title mb-10 max-w-[20ch]">
            {l.stepsTitle}
          </h2>
          <ol className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {l.steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                <span className="font-serif text-[2rem] leading-none text-gilt">{i + 1}</span>
                <div>
                  <h3 className="t-heading">{s.title}</h3>
                  <p className="mt-2 max-w-[48ch] text-ash">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="guest" className="grid gap-8 border-t border-line py-16 sm:py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <h2 id="guest" className="t-title">
              {l.guestTitle}
            </h2>
            <p className="mt-4 max-w-[50ch] text-ash">{l.guestBody}</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line" aria-hidden>
            {[
              ["New York", "Nocturne Studio", t.artist.status.booking, "text-verdigris"],
              ["London", "Saint Ink", t.artist.status.booking, "text-verdigris"],
              ["Milan", "Officina Nera", t.artist.status.announced, "text-ash"],
            ].map(([city, studio, status, tone]) => (
              <li key={city} className="flex items-center justify-between gap-4 bg-niche px-5 py-4">
                <span>
                  <span className="font-serif text-[1.35rem]">{city}</span>
                  <span className="block text-[0.85rem] text-ash">{studio}</span>
                </span>
                <span className={`pill ${tone}`}>{status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-6 border-t border-line py-16 sm:py-20">
          <h2 id="pricing-title" className="t-title">
            {l.pricingTitle}
          </h2>
          <p className="mt-3 text-ash">{l.pricingNote}</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {l.plans.map((p) => (
              <li key={p.name} className={`flex flex-col rounded-[var(--radius-lg)] border p-5 ${p.highlight ? "border-gilt bg-niche" : "border-line"}`}>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-3">
                  <span className="font-serif text-[2.4rem] leading-none">{p.price}</span>
                  <span className="ml-1 text-[0.85rem] text-ash">{p.period}</span>
                </p>
                <p className="mt-4 text-[0.92rem] text-ash">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="access" aria-labelledby="access-title" className="scroll-mt-6 grid gap-8 border-t border-line py-16 sm:py-20 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h2 id="access-title" className="t-title">
              {l.accessTitle}
            </h2>
            <p className="mt-4 max-w-[44ch] text-ash">{l.accessBody}</p>
          </div>
          <AccessForm
            labels={{ email: l.accessEmail, instagram: l.accessInstagram, city: l.accessCity, submit: l.accessSubmit, done: l.accessDone, optional: t.common.optional }}
          />
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-8 text-[0.85rem] text-ash sm:px-6">
        <Wordmark />
        <p>{l.footer}</p>
      </footer>
    </>
  );
}
