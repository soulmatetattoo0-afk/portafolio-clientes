import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { getClientUser } from "@/lib/client";

/**
 * The bar every world page shares: the masthead home (or a way back),
 * search, the person's own space (or a way in), and the language. The
 * artist's experience and the studio keep their own chrome.
 */
export async function WorldBar({ back, next, search = true }: { back?: { href: string; label: string } | null; next?: string; search?: boolean } = {}) {
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
        <Link href="/" className="p-display flex min-h-11 items-center text-[1.5rem] leading-none text-bone" aria-label={n.home}>
          {BRAND.name}
        </Link>
      )}
      <nav className="flex items-center" aria-label={n.home}>
        {search && (
          <Link href="/explore" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-bone hover:bg-ink-2" aria-label={n.search} title={n.search}>
            <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
          </Link>
        )}
        <Link href={me ? "/me" : `/me/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="p-stamp inline-flex min-h-11 items-center px-2 text-bone">
          {me ? (me.name?.split(" ")[0] ?? n.me) : n.signIn}
        </Link>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </nav>
    </header>
  );
}
