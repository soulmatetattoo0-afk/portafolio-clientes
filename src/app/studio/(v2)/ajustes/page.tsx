import Link from "next/link";

import { logout } from "@/app/login/actions";
import { startStripeConnect } from "@/app/studio/_legacy/actions";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { live, manualPayments } from "@/lib/env";
import { getArtistById } from "@/lib/queries";
import { SettingsForm } from "@/v2/SettingsForm";
import { ArtistTabs } from "@/v2/Shell";
import { storageForBrowser } from "@/v2/pages";

export const metadata = { robots: { index: false } };

/** Ajustes: the month in numbers, then the few things the artist sets: prices, styles, the care sheets, payouts, the account. */
export default async function SettingsPage() {
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const s = t.v2.settings;
  return (
    <div className="v2-page min-h-dvh">
      <header className="v2-top">
        <Link href="/studio/sala" className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.room.title}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 text-[1.8rem] uppercase leading-none">{s.title}</h1>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-3">
        <SettingsForm artist={artist} storage={storageForBrowser()} t={t} locale={locale} />

        <section className="mt-8">
          <p className="p-stamp text-bone/60">{s.payments}</p>
          <div className="v2-sheet mt-2 p-4">
            <p className="text-[0.92rem]">{live.payments ? s.stripeLead : manualPayments ? s.stripeManual : s.stripeDemo}</p>
            {live.payments && (
              <form action={startStripeConnect} className="mt-3">
                <button type="submit" className="v2-btn" data-tone={artist.stripe_charges_enabled ? "ghost" : "accent"}>
                  {artist.stripe_charges_enabled ? s.stripeOk : s.stripe}
                </button>
              </form>
            )}
          </div>
        </section>

        <form action={logout} className="mt-8 flex justify-end">
          <button type="submit" className="v2-btn" data-tone="ghost">
            {s.signOut}
          </button>
        </form>
      </main>
      <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} />
    </div>
  );
}
