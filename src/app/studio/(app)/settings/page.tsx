import Link from "next/link";

import { logout } from "@/app/login/actions";
import { PolicyList } from "@/components/Policy";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { isFull } from "@/lib/plan";
import { getArtistById } from "@/lib/queries";

import { refreshStripeStatus, startStripeConnect } from "../actions";
import { CopyButton } from "../CopyButton";
import { CoverPhoto } from "./CoverPhoto";
import { ProfileForm, RulesForm } from "./SettingsForms";

export default async function SettingsPage({ searchParams }: PageProps<"/studio/settings">) {
  const member = await requireMember();
  const sp = await searchParams;
  if (sp.stripe === "return" || sp.stripe === "refresh") await refreshStripeStatus();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const db = await getDb();
  const [studio, counts] = await Promise.all([
    db.one<{ plan: string; subscription_status: string }>(`select plan, subscription_status from studios where id = $1`, [member.studioId]),
    db.one<{ pieces: number; featured: number; healed: number; spots: number }>(
      `select (select count(*) from portfolio_items where artist_id = $1 and published)::int as pieces,
              (select count(*) from portfolio_items where artist_id = $1 and published and featured and coalesce(story, '') <> '')::int as featured,
              (select count(*) from portfolio_items where artist_id = $1 and published and is_healed)::int as healed,
              (select count(*) from tour_stops where artist_id = $1 and not is_home and status in ('announced', 'booking') and (ends_on is null or ends_on >= current_date))::int as spots`,
      [member.artistId],
    ),
  ]);
  const s = t.studio.settings;
  const d = s.discovery;
  const pl = t.studio.plan;
  const sections = [
    ["profile", s.sections.profile],
    ["cover", s.cover.title],
    ["discovery", d.title],
    ["booking", s.sections.booking],
    ["payments", s.sections.payments],
    ["plan", s.sections.plan],
  ] as const;
  const pageUrl = `${env.appUrl}/${artist.slug}`;
  const located = artist.lat != null && artist.lng != null;

  // What the search card is built from, each line pointing at the place that fixes it. No score.
  const checks: { key: keyof typeof d.checks; ok: boolean; href: string }[] = [
    { key: "portrait", ok: Boolean(artist.portrait_url), href: "/studio/settings#cover" },
    { key: "pieces", ok: Number(counts?.pieces ?? 0) >= 6, href: "/studio/portfolio" },
    { key: "featured", ok: Number(counts?.featured ?? 0) >= 3, href: "/studio/portfolio" },
    { key: "healed", ok: Number(counts?.healed ?? 0) >= 1, href: "/studio/portfolio" },
    { key: "located", ok: located, href: "/studio/settings#discovery" },
    { key: "accepting", ok: artist.accepting, href: "/studio/settings#profile" },
    { key: "spot", ok: Number(counts?.spots ?? 0) >= 1, href: "/studio/cities" },
    { key: "stripe", ok: artist.stripe_charges_enabled, href: "/studio/settings#payments" },
  ];
  const plan = studio?.plan ?? "basic";
  const planLabel = (s.plans as Record<string, string>)[plan] ?? plan;
  const houseEmail = env.emailFrom.match(/<([^>]+)>/)?.[1] ?? env.emailFrom;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:py-10">
      <div className="lg:col-span-2">
        <h1 className="t-title">{s.title}</h1>
      </div>
      <nav aria-label={s.title} className="lg:sticky lg:top-8 lg:self-start">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:flex-col">
          {sections.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-ash hover:text-vellum">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-14">
        <section id="profile" aria-labelledby="profile-h" className="scroll-mt-8">
          <h2 id="profile-h" className="t-heading mb-1">
            {s.sections.profile}
          </h2>
          <div className="mb-6 flex flex-wrap items-center gap-3 text-[0.92rem] text-ash">
            <Link href={`/${artist.slug}`} className="link" target="_blank">
              {pageUrl.replace(/^https?:\/\//, "")}
            </Link>
            <CopyButton text={pageUrl} label={t.common.copy} done={t.common.copied} className="btn btn-ghost btn-sm" />
          </div>
          <ProfileForm
            artist={artist}
            locale={locale}
            labels={{
              name: s.name,
              instagram: s.instagram,
              headline: s.headline,
              headlineHint: s.headlineHint,
              bio: s.bio,
              homeCity: s.homeCity,
              minPrice: s.minPrice,
              minPriceHint: s.minPriceHint,
              styles: s.styles,
              stylesHint: s.stylesHint,
              accepting: s.accepting,
              save: t.common.save,
              optional: t.common.optional,
              coverTitle: s.cover.title,
              coverLead: s.cover.lead,
              coverWord: s.cover.word,
              coverWordHint: s.cover.wordHint,
              quote: s.cover.quote,
              quoteHint: s.cover.quoteHint,
              since: s.cover.since,
              accent: s.cover.accent,
              accentHint: s.cover.accentHint,
              poster: s.cover.poster,
              posterHint: s.cover.posterHint,
              discoveryTitle: d.title,
              discoveryLead: d.lead,
              trade: d.trade,
              tradeHint: d.tradeHint,
              country: d.country,
              listed: d.listed,
              listedHint: d.listedHint,
              mapTitle: d.mapTitle,
            }}
            cover={
              <CoverPhoto
                url={artist.portrait_url}
                storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
                labels={{ upload: s.cover.upload, replace: s.cover.replace, remove: s.cover.remove, hint: s.cover.photoHint, error: t.brief.errors.upload }}
              />
            }
            mapLine={
              !artist.home_city ? (
                <p className="text-[0.92rem] text-ash">{d.mapNoCity}</p>
              ) : located ? (
                <p className="t-num text-[0.92rem]">{fill(d.mapAt, { city: artist.home_city, lat: artist.lat!.toFixed(2), lng: artist.lng!.toFixed(2) })}</p>
              ) : (
                <p className="text-[0.92rem] text-ash">{d.mapUnknown}</p>
              )
            }
            checklist={
              <div className="rounded-[var(--radius-md)] border border-line p-4 sm:p-5">
                <p className="t-label">{d.checklistTitle}</p>
                <p className="mt-1 mb-4 max-w-[60ch] text-[0.88rem] text-ash-dim">{d.checklistLead}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {checks.map((c) => (
                    <li key={c.key} className="flex items-start gap-2.5 text-[0.92rem]">
                      <span aria-hidden className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.65rem] ${c.ok ? "border-verdigris text-verdigris" : "border-line-strong text-transparent"}`}>
                        ✓
                      </span>
                      {c.ok ? (
                        <span>{d.checks[c.key]}</span>
                      ) : (
                        <Link href={c.href} className="link text-ash">
                          {d.checks[c.key]}
                        </Link>
                      )}
                      {c.ok && <span className="sr-only">({d.done})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        </section>

        <section id="booking" aria-labelledby="booking-h" className="scroll-mt-8 border-t border-line pt-10">
          <h2 id="booking-h" className="t-heading mb-6">
            {s.sections.booking}
          </h2>
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <RulesForm
              artist={artist}
              labels={{
                refundable: s.refundable,
                appliesToFinal: s.appliesToFinal,
                rescheduleHours: s.rescheduleHours,
                reschedules: s.reschedules,
                save: t.common.save,
              }}
            />
            <div className="rounded-[var(--radius-md)] border border-line p-4">
              <p className="t-label mb-3">{t.artist.policyTitle}</p>
              <PolicyList policy={artist.deposit_policy} t={t} />
            </div>
          </div>
        </section>

        <section id="payments" aria-labelledby="payments-h" className="scroll-mt-8 border-t border-line pt-10">
          <h2 id="payments-h" className="t-heading mb-3">
            {s.stripeTitle}
          </h2>
          {!live.payments ? (
            <p className="text-ash">{s.stripeDemo}</p>
          ) : artist.stripe_charges_enabled ? (
            <p className="text-verdigris">{s.stripeConnected}</p>
          ) : (
            <form action={startStripeConnect} className="grid gap-4">
              <p className="max-w-[60ch] text-ash">{artist.stripe_account_id ? s.stripePending : s.stripeNone}</p>
              <button type="submit" className="btn btn-primary w-fit">
                {artist.stripe_account_id ? s.stripeContinue : s.stripeConnect}
              </button>
            </form>
          )}
        </section>

        <section id="plan" aria-labelledby="plan-h" className="scroll-mt-8 border-t border-line pt-10">
          <h2 id="plan-h" className="t-heading mb-3">
            {s.sections.plan}
          </h2>
          <p className="mb-6">
            <span className="t-label mr-2">{pl.current}</span>
            <span className="font-serif text-[1.25rem]">{planLabel}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["basic", pl.basicName, pl.basicPrice, pl.basicDesc],
                ["full", pl.fullName, pl.fullPrice, pl.fullDesc],
              ] as const
            ).map(([tier, name, price, desc]) => {
              const mine = tier === "full" ? isFull(plan) : !isFull(plan);
              return (
                <div key={tier} className={`grid content-start gap-2 rounded-[var(--radius-md)] border p-4 sm:p-5 ${mine ? "border-line-strong bg-niche" : "border-line"}`} aria-current={mine ? "true" : undefined}>
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[1.35rem]">{name}</span>
                    <span className="t-num text-[0.92rem] text-ash">{price}</span>
                  </p>
                  <p className="text-[0.9rem] text-ash">{desc}</p>
                </div>
              );
            })}
          </div>
          {plan === "founding" ? (
            <p className="mt-4 text-[0.9rem] text-ash">{pl.founding}</p>
          ) : !isFull(plan) ? (
            <div className="mt-5 grid gap-1">
              <a href={`mailto:${houseEmail}?subject=${encodeURIComponent(`${pl.request}: ${artist.display_name}`)}`} className="btn btn-primary w-fit">
                {pl.request}
              </a>
              <p className="text-[0.85rem] text-ash-dim">{pl.requestHint}</p>
            </div>
          ) : null}
        </section>

        <form action={logout} className="border-t border-line pt-8 lg:hidden">
          <button type="submit" className="btn btn-secondary">
            {t.common.signOut}
          </button>
        </form>
      </div>
    </main>
  );
}
