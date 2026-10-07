"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n";

export function LangToggle({ locale, label, title }: { locale: Locale; label: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      lang={locale === "en" ? "es" : "en"}
      title={title}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await setLocale(locale === "en" ? "es" : "en");
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
