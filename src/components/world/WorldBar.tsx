import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { getClientUser } from "@/lib/client";

/**
 * The bar every world page shares: the masthead home, search, the person's
 * own space (or a way in), and the language. The artist's experience and the
 * studio keep their own chrome.
 */
export async function WorldBar({ back, next }: { back?: { href: string; label: string } | null; next?: string } = {}) {
  const [{ t, locale }, me] = await Promise.all([getDict(), getClientUser()]);
  const n = t.world.nav;
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),0.9rem)] pb-2">
      {back ? (
        <Link href={back.href} className="p-stamp flex items-center gap-2 py-2 text-bone">
          <span aria-hidden className="text-[1.2rem] leading-none">←</span>
          {back.label.toUpperCase()}
        </Link>
      ) : (
        <Link href="/" className="p-display text-[1.6rem] leading-none text-bone" aria-label={n.home}>
          {BRAND.name}
        </Link>
      )}
      <nav className="flex items-center gap-1" aria-label={n.home}>
        <Link href="/explore" className="btn btn-ghost px-2 text-bone" aria-label={n.search}>
          <span aria-hidden>⌕</span>
        </Link>
        <Link href={me ? "/me" : `/me/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="p-stamp px-2 py-2 text-bone">
          {me ? (me.name?.split(" ")[0] ?? n.me) : n.signIn}
        </Link>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </nav>
    </header>
  );
}
