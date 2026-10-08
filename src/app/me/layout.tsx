import { DemoBanner } from "@/components/Chrome";
import { WorldBar } from "@/components/world/WorldBar";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";

import { MeTabs } from "./MeTabs";

/**
 * The client's own space. The poster theme in the house accent; each page
 * gates itself with requireClient so the way back is the page that was asked for.
 */
export default async function MeLayout({ children }: LayoutProps<"/me">) {
  const { t } = await getDict();
  const n = t.me.nav;
  return (
    <div className="poster relative flex min-h-dvh flex-col" style={{ ["--accent" as string]: BRAND.accent }}>
      <div className="p-grain" aria-hidden />
      <DemoBanner />
      <WorldBar />
      <MeTabs
        label={n.label}
        tabs={[
          { href: "/me", label: n.overview },
          { href: "/me/saved", label: n.saved },
          { href: "/me/briefs", label: n.briefs },
          { href: "/me/appointments", label: n.appointments },
          { href: "/me/alerts", label: n.alerts },
          { href: "/me/settings", label: n.settings },
        ]}
      />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24">{children}</main>
    </div>
  );
}
