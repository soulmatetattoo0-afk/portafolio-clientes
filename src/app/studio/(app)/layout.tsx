import Link from "next/link";

import { logout } from "@/app/login/actions";
import { DemoBanner, Wordmark } from "@/components/Chrome";
import { LangToggle } from "@/components/LangToggle";
import { PushPrompt } from "@/components/PushPrompt";
import { vapidKeys } from "@/lib/push";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById, inboxCounts } from "@/lib/queries";

import { StudioNav } from "./StudioNav";

export const metadata = { title: "Studio", robots: { index: false } };

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  const member = await requireMember();
  const [{ t, locale }, artist, counts] = await Promise.all([getDict(), getArtistById(member.artistId), inboxCounts(member.studioId)]);
  const n = t.studio.nav;
  return (
    <>
      <DemoBanner />
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
          <div className="mb-3 flex items-center justify-between gap-3 lg:mb-8 lg:block">
            <div className="min-w-0">
              <Link href="/studio" className="block py-1">
                <Wordmark />
              </Link>
              <p className="mt-1 truncate font-serif text-[1.15rem] lg:mt-3">{artist?.display_name}</p>
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
            </div>
          </div>
          <StudioNav
            items={[
              { href: "/studio", label: n.requests, badge: counts.new },
              { href: "/studio/agenda", label: n.agenda },
              { href: "/studio/bookings", label: n.bookings },
              { href: "/studio/portfolio", label: n.portfolio },
              { href: "/studio/magazine", label: n.magazine },
              { href: "/studio/flash", label: n.flash },
              { href: "/studio/cities", label: n.cities },
              { href: "/studio/settings", label: n.settings },
            ]}
          />
          <div className="mt-auto hidden gap-1 pt-6 lg:grid">
            {artist && (
              <Link href={`/${artist.slug}`} className="btn btn-ghost btn-sm justify-start" target="_blank">
                {n.myPage}
              </Link>
            )}
            <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm w-full justify-start">
                {t.common.signOut}
              </button>
            </form>
          </div>
        </aside>
        <div className="min-w-0">
          {/* Requests and messages reach the artist's phone with the app closed. */}
          <PushPrompt
            vapidKey={vapidKeys().publicKey}
            className="mx-4 mt-4 sm:mx-6 lg:mx-10"
            labels={{ title: t.push.title, body: t.push.bodyArtist, enable: t.push.enable, on: t.push.on, denied: t.push.denied, ios: t.push.ios }}
          />
          {children}
        </div>
      </div>
    </>
  );
}
