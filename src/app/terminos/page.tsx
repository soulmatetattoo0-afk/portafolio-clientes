import type { Metadata } from "next";

import { LegalSheet } from "@/components/LegalSheet";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.legal.title };
}

/** The terms and booking policy: short, plain, one page, on paper. */
export default async function TermsPage() {
  const { t, locale } = await getDict();
  return <LegalSheet doc={t.legal} other={{ href: "/privacidad", label: t.privacy.title }} t={t} locale={locale} />;
}
