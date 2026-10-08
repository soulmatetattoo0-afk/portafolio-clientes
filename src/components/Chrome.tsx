import Link from "next/link";

import { getDict } from "@/i18n/server";
import { demoMode } from "@/lib/env";

import { LangToggle } from "./LangToggle";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`t-inscription text-[0.95rem] tracking-[0.3em] text-gilt ${className}`} aria-label="Vanta">
      VANTA
    </span>
  );
}

export async function DemoBanner() {
  if (!demoMode) return null;
  const { t } = await getDict();
  return (
    <p className="border-b border-line bg-niche px-4 py-2 text-center text-[0.8125rem] text-ash" role="note">
      {t.common.demo}
    </p>
  );
}

/** Thin top bar for public pages: wordmark (or the artist's name), language switch. */
export async function PublicBar({ children }: { children?: React.ReactNode }) {
  const { t, locale } = await getDict();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {children ?? (
          <Link href="/" className="py-2">
            <Wordmark />
          </Link>
        )}
      </div>
      <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
    </header>
  );
}
