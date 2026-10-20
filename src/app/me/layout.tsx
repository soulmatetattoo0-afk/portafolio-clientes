import { DemoBanner } from "@/components/Chrome";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { getClientUser, listFollowed, unreadChats } from "@/lib/client";
import { ClientTabs } from "@/v2/Shell";

/** The client's app: Mensajes and Perfil, with the way back to the artist they came from. */
export default async function MeLayout({ children }: LayoutProps<"/me">) {
  const [{ t }, me] = await Promise.all([getDict(), getClientUser()]);
  const [unread, followed] = me ? await Promise.all([unreadChats(me.userId), listFollowed(me.userId)]) : [0, []];
  const tabs = t.v2.tabs;
  return (
    <div className="poster v2-page relative flex min-h-dvh flex-col" style={{ ["--accent" as string]: BRAND.accent }}>
      <DemoBanner />
      {children}
      {me && <ClientTabs slug={followed[0]?.slug ?? null} labels={{ page: tabs.page, messages: tabs.messages, profile: tabs.profile, bar: t.me.nav.label }} badge={unread} />}
    </div>
  );
}
