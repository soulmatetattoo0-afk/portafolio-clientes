import { getDict } from "@/i18n/server";
import { LangToggle } from "@/components/LangToggle";
import { CoverSheet } from "@/components/magazine/Sheet";
import { styleLabel } from "@/lib/catalog";
import { listMyArtists, requireClient } from "@/lib/client";
import { getMagazine } from "@/lib/magazine-server";

import { ArtistShelf } from "./ArtistShelf";

export const metadata = { robots: { index: false } };

/** Mis artistas: the artists the client saved, wrote to or visited, each as the cover of their magazine. */
export default async function MyArtistsPage() {
  const me = await requireClient("/me/artistas");
  const [{ t, locale }, artists] = await Promise.all([getDict(), listMyArtists(me.userId)]);
  const m = t.v2.me.artists;
  const ph = Object.fromEntries(Object.keys(t.magazine.ph).map((k) => [k, ""])) as typeof t.magazine.ph;
  const covers = await Promise.all(
    artists.map(async (a) => {
      const { doc, urls } = await getMagazine(a.id);
      return (
        <CoverSheet
          key={a.id}
          cover={doc.cover}
          name={a.name}
          urls={urls}
          ph={ph}
          meta={{ city: a.city, styles: a.styles.map((s) => styleLabel(s, locale)), line: null, accent: a.accent, words: t.magazine.cover }}
        />
      );
    }),
  );
  return (
    <div className="min-h-dvh">
      <header className="flex items-end justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.9rem)] pb-1">
        <div>
          <h1 className="p-display text-[2.3rem] uppercase leading-none">{m.title}</h1>
          <p className="mt-1 text-[0.85rem] text-bone/60">{m.lead}</p>
        </div>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>
      <ArtistShelf
        artists={artists.map((a, i) => ({ ...a, cover: covers[i] }))}
        labels={{ recent: m.recent, saved: m.saved, chats: m.chats, az: m.az, search: m.search, empty: m.empty, none: m.none, savedBadge: m.savedBadge, chatBadge: m.chatBadge }}
        locale={locale}
      />
    </div>
  );
}
