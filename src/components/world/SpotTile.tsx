import Link from "next/link";

import { dict, fill, type Locale } from "@/i18n";
import { dateRange } from "@/lib/format";
import type { SpotCard as Spot } from "@/lib/search";

import { CoverPlate } from "./CoverPlate";

/**
 * One guest artist in the strip, as a portrait: who, the city they are
 * coming to and when. Wears the page's accent. Taps through to the
 * artist's dates.
 */
export function SpotTile({ spot, locale, priority = false }: { spot: Spot; locale: Locale; priority?: boolean }) {
  const { artist, stop } = spot;
  const t = dict(locale);
  const status = t.artist.status[stop.status as "announced" | "booking"] ?? stop.status;
  return (
    <li className="w-[46vw] max-w-[220px] shrink-0 snap-start">
      <Link href={`/${artist.slug}#spots`} className="group block overflow-hidden rounded-[14px] bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
        <span className="relative block aspect-[3/4] overflow-hidden [container-type:inline-size]">
          {artist.portrait_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.portrait_url} alt="" loading={priority ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03] ${artist.cover_poster ? "" : "grayscale"}`} />
          ) : (
            <CoverPlate name={artist.display_name} compact />
          )}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
          <span className="absolute inset-x-3 bottom-3 block">
            <span className="p-display block text-[clamp(1.25rem,10cqw,1.7rem)] leading-[0.92] text-bone">{artist.display_name}</span>
            <span className="p-gothic mt-1.5 block text-[1rem] leading-tight text-accent">
              {fill(t.world.card.inCity, { city: stop.city })} <span className="whitespace-nowrap">· {dateRange(stop.starts_on, stop.ends_on, locale)}</span>
            </span>
            <span className="p-stamp mt-1.5 block text-[0.52rem] text-bone/70">{status}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
