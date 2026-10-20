"use client";

import Link from "next/link";

import { CoverSheet, Sheet } from "@/components/magazine/Sheet";
import type { Dict, Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { Magazine as MagazineData } from "@/lib/magazine-server";
import type { Artist } from "@/lib/queries";

import { MagBook } from "./MagBook";
import { Pencil } from "./Work";

/** Revista: the magazine as a book, opened and leafed under a moving camera. The owner's copy carries the button that edits it. */
export function Magazine({ artist, magazine, locale, t, back, editHref }: { artist: Artist; magazine: MagazineData; locale: Locale; t: Dict; back: string; editHref: string | null }) {
  const { doc, urls } = magazine;
  // Clients never see the editor's guide text: an empty box is empty.
  const ph = Object.fromEntries(Object.keys(t.magazine.ph).map((k) => [k, ""])) as typeof t.magazine.ph;
  const cover = (
    <CoverSheet
      cover={doc.cover}
      name={artist.display_name}
      urls={urls}
      ph={ph}
      meta={{ city: artist.home_city, styles: artist.styles.map((s) => styleLabel(s, locale)), line: artist.cover_quote?.trim() || artist.headline?.trim() || null, accent: artist.accent, words: t.magazine.cover }}
    />
  );
  const pages = doc.pages.map((page) => <Sheet key={page.id} page={page} urls={urls} ph={ph} />);
  return (
    <div className="poster v2-page flex h-dvh flex-col" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="v2-top">
        <Link href={back} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <h1 className="p-display flex-1 truncate text-[1.6rem] uppercase leading-none">{t.v2.mag.title}</h1>
      </header>
      <MagBook cover={cover} pages={pages} labels={{ cover: t.v2.mag.cover, page: t.v2.mag.page, next: t.artist.panel.next, prev: t.artist.panel.prev }} className={`min-h-0 flex-1 ${editHref ? "pb-16" : ""}`} />
      {editHref && (
        <Link href={editHref} className="v2-fab" data-tone="accent">
          <Pencil /> {t.v2.edit.magazine}
        </Link>
      )}
    </div>
  );
}
