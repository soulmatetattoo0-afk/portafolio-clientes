import Link from "next/link";

import { logout } from "@/app/login/actions";
import { DemoBanner, Wordmark } from "@/components/Chrome";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";

import { AdminNav } from "./AdminNav";

export const metadata = { title: "Vanta · House", robots: { index: false } };

/** The house desk: the same chrome as the studio, a short nav of its own. Only admins get past the gate. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const { t, locale } = await getDict();
  const a = t.admin;
  return (
    <>
      <DemoBanner />
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
          <div className="mb-3 flex items-center justify-between gap-3 lg:mb-8 lg:block">
            <div className="min-w-0">
              <Link href="/admin/plans" className="block py-1">
                <Wordmark />
              </Link>
              <p className="mt-1 truncate font-serif text-[1.15rem] lg:mt-3">{a.title}</p>
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
            </div>
          </div>
          <AdminNav items={[{ href: "/admin/plans", label: a.nav.plans }]} />
          <div className="mt-auto hidden gap-1 pt-6 lg:grid">
            <Link href="/studio/settings" className="btn btn-ghost btn-sm justify-start">
              {t.studio.nav.settings}
            </Link>
            <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm w-full justify-start">
                {t.common.signOut}
              </button>
            </form>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
