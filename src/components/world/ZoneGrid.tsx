"use client";

import { useState } from "react";

import type { Locale } from "@/i18n";
import type { ArtistCard as Card } from "@/lib/queries";

import { ArtistCard } from "./ArtistCard";

export interface ZoneItem {
  artist: Card;
  /** Visiting on a guest spot, or living and working here. */
  kind: "visit" | "resident";
}

/**
 * Artists in the person's zone, visitors and residents in one grid: the
 * visitors first, soonest first, each with their dates; a switch filters
 * without a round trip.
 */
export function ZoneGrid({ items, locale, following, labels }: { items: ZoneItem[]; locale: Locale; following: string[] | null; labels: { all: string; visit: string; resident: string; filter: string } }) {
  const [show, setShow] = useState<"all" | ZoneItem["kind"]>("all");
  const follows = following ? new Set(following) : null;
  const list = items.filter((i) => show === "all" || i.kind === show);
  return (
    <div className="mt-5 grid gap-4">
      <div className="seg w-fit" role="group" aria-label={labels.filter}>
        {(["all", "visit", "resident"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>
            {k === "all" ? labels.all : k === "visit" ? labels.visit : labels.resident}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {list.map(({ artist, kind }, i) => (
          <li key={`${kind}-${artist.id}`} className="relative">
            <ArtistCard artist={artist} locale={locale} following={follows ? follows.has(artist.id) : null} priority={i < 2} />
            {kind === "resident" && (
              <span className="p-stamp pointer-events-none absolute top-2 left-2 rounded-full bg-ink/80 px-2 py-1 text-[0.55rem] text-bone backdrop-blur">{labels.resident}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
