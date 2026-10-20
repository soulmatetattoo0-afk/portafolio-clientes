import Link from "next/link";

import type { Dict } from "@/i18n";
import type { Artist } from "@/lib/queries";

import { ArtistTabs } from "./Shell";

/** One room off the Sala creativa's engine room: the way back, its name, a line saying what it is for, its contents, the bar. */
export function Room({ artist, t, title, lead, children }: { artist: Artist; t: Dict; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="v2-page min-h-dvh" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="v2-top">
        <Link href="/studio/sala" className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.room.title}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 truncate text-[1.8rem] uppercase leading-none">{title}</h1>
      </header>
      <main className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 px-3 pt-2 pb-6">
        {lead && <p className="px-1 text-[0.92rem] leading-snug text-bone/70">{lead}</p>}
        {children}
      </main>
      <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} />
    </div>
  );
}
