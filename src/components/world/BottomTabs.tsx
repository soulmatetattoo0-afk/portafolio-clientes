import { getDict } from "@/i18n/server";
import { getClientUser, unreadChats } from "@/lib/client";

import { TabLinks } from "./TabLinks";

/**
 * The tab bar every client page shares, fixed to the bottom like a native
 * app: Home, Search, Chats (with the unread count) and You. Signed out,
 * Chats and You lead to sign-in and come back. A spacer keeps the last
 * content clear of it.
 */
export async function BottomTabs() {
  const [{ t }, me] = await Promise.all([getDict(), getClientUser()]);
  const unread = me ? await unreadChats(me.userId) : 0;
  const n = t.world.tabs;
  const signIn = (next: string) => `/me/signin?next=${encodeURIComponent(next)}`;
  return (
    <>
      <div aria-hidden className="h-[calc(64px+env(safe-area-inset-bottom))]" />
      <TabLinks
        label={n.label}
        unreadLabel={unread ? `${unread} ${n.unread}` : null}
        unread={unread}
        tabs={[
          { key: "home", href: "/", label: n.home, match: ["/"] },
          { key: "search", href: "/explore", label: n.search, match: ["/explore", "/city"] },
          { key: "chats", href: me ? "/me/briefs" : signIn("/me/briefs"), label: n.chats, match: ["/me/briefs", "/c/"] },
          { key: "you", href: me ? "/me" : signIn("/me"), label: n.you, match: ["/me"] },
        ]}
      />
    </>
  );
}
