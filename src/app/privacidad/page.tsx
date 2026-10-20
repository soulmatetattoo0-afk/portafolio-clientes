import type { Metadata } from "next";

import { LegalSheet } from "@/components/LegalSheet";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.privacy.title };
}

/** The privacy policy: what VANTA keeps, why, who else sees it, and how to have it erased. */
export default async function PrivacyPage() {
  const { t, locale } = await getDict();
  return <LegalSheet doc={t.privacy} other={{ href: "/terminos", label: t.legal.title }} t={t} locale={locale} />;
}
