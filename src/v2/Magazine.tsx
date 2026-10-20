"use client";

import Link from "next/link";

import { Ch } from "@/components/mag/Chapter";
import { Mag } from "@/components/mag/Mag";
import { CoverSheet, Sheet } from "@/components/magazine/Sheet";
import type { Dict, Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { Magazine as MagazineData } from "@/lib/magazine-server";
import type { Artist } from "@/lib/queries";

import { Pencil } from "./Work";

/** Revista: the cover and the pages, leafed one at a time. The owner's copy carries the button that edits it. */
export function Magazine({ artist, magazine, locale, t, back, editHref }: { artist: Artist; magazine: MagazineData; locale: Locale; t: Dict; back: string; editHref: string | null }) {
  const { doc, urls } = magazine;
  // Clients never see the editor's guide text: an empty box is empty.
  const ph = Object.fromEntries(Object.keys(t.magazine.ph).map((k) => [k, ""])) as typeof t.magazine.ph;
  const hold = (node: React.ReactNode) => (
    <Ch tone="ink">
      <div className="absolute inset-0 grid place-items-center p-[2cqmin]">
        <div className="w-[min(100%,calc((100cqh-4cqmin)*2/3))] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">{node}</div>
      </div>
    </Ch>
  );
  const chapters = [
    {
      key: "cover",
      label: t.v2.mag.cover,
      node: hold(
        <CoverSheet
          cover={doc.cover}
          name={artist.display_name}
          urls={urls}
          ph={ph}
          meta={{ city: artist.home_city, styles: artist.styles.map((s) => styleLabel(s, locale)), line: artist.cover_quote?.trim() || artist.headline?.trim() || null, accent: artist.accent, words: t.magazine.cover }}
        />,
      ),
    },
    ...doc.pages.map((page, k) => ({ key: page.id, label: t.v2.mag.page.replace("{n}", String(k + 1)), node: hold(<Sheet page={page} urls={urls} ph={ph} />) })),
  ];
  return (
    <div className="poster v2-page flex h-dvh flex-col" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="v2-top">
        <Link href={back} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 truncate text-[1.6rem] uppercase leading-none">{t.v2.mag.title}</h1>
      </header>
      <Mag chapters={chapters} labels={{ page: t.artist.panel.bio.mag.page, next: t.artist.panel.next, prev: t.artist.panel.prev }} className="min-h-0 flex-1" />
      {editHref && (
        <Link href={editHref} className="v2-fab" data-tone="accent">
          <Pencil /> {t.v2.edit.magazine}
        </Link>
      )}
    </div>
  );
}
