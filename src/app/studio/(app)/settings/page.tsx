import Link from "next/link";

import { logout } from "@/app/login/actions";
import { PolicyList } from "@/components/Policy";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { getArtistById } from "@/lib/queries";

import { refreshStripeStatus, startStripeConnect } from "../actions";
import { CopyButton } from "../CopyButton";
import { ProfileForm, RulesForm } from "./SettingsForms";

export default async function SettingsPage({ searchParams }: PageProps<"/studio/settings">) {
  const member = await requireMember();
  const sp = await searchParams;
  if (sp.stripe === "return" || sp.stripe === "refresh") await refreshStripeStatus();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const db = await getDb();
  const studio = await db.one<{ plan: "founding" | "artist" | "pro" | "studio"; subscription_status: string }>(`select plan, subscription_status from studios where id = $1`, [member.studioId]);
  const s = t.studio.settings;
  const sections = [
    ["profile", s.sections.profile],
    ["booking", s.sections.booking],
    ["payments", s.sections.payments],
    ["plan", s.sections.plan],
  ] as const;
  const pageUrl = `${env.appUrl}/${artist.slug}`;

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
              accepting: s.accepting,
              save: t.common.save,
              optional: t.common.optional,
            }}
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
          <p>
            <span className="t-label mr-2">{s.planName}</span>
            {studio ? s.plans[studio.plan] : ""}
          </p>
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
