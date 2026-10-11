import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { VantaMark, VantaWord } from "@/components/brand/VantaLogo";
import { getClientUser } from "@/lib/client";

/**
 * The bar every world page shares: the VANTA logo home (or a way back), a
 * way in when signed out, and the language. Search, chats and the person's
 * space live in the tab bar at the bottom. The
 * artist's experience and the studio keep their own chrome.
 */
export async function WorldBar({ back, next }: { back?: { href: string; label: string } | null; next?: string; search?: boolean } = {}) {
  const [{ t, locale }, me] = await Promise.all([getDict(), getClientUser()]);
  const n = t.world.nav;
  return (
    <header className="relative z-20 flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {back ? (
        <Link href={back.href} className="p-stamp flex min-h-11 items-center gap-2 py-2 text-bone">
          <span aria-hidden className="text-[1.2rem] leading-none">←</span>
          <span className="truncate">{back.label.toUpperCase()}</span>
        </Link>
      ) : (
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-bone" aria-label={n.home}>
          <VantaMark className="h-7 w-auto" />
          <VantaWord className="h-[0.62rem] w-auto" />
        </Link>
      )}
      <nav className="flex items-center" aria-label={n.home}>
        {!me && (
          <Link href={`/me/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="p-stamp inline-flex min-h-11 items-center px-2 text-bone">
            {n.signIn}
          </Link>
        )}
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </nav>
    </header>
  );
}
