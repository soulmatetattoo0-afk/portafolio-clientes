import Link from "next/link";

import { dict, type Locale } from "@/i18n";
import { dateRange } from "@/lib/format";
import type { SpotCard as Spot } from "@/lib/search";

import { CoverPlate } from "./CoverPlate";

/** One row of the guest-spot strip: who, where, when. Taps through to the artist's dates. */
export function SpotCard({ spot, locale, lead = false }: { spot: Spot; locale: Locale; lead?: boolean }) {
  const { artist, stop } = spot;
  const t = dict(locale);
  const style = lead && artist.accent ? ({ "--accent": artist.accent } as React.CSSProperties) : undefined;
  return (
    <li style={style}>
      <Link href={`/${artist.slug}#spots`} className="flex items-center gap-3 rounded-[14px] border border-line bg-ink-2 p-2 pr-4 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
        <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-[8px] bg-ink [container-type:inline-size]">
          {artist.portrait_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.portrait_url} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
          ) : (
            <CoverPlate name={artist.display_name} compact />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="p-display block truncate text-[1.25rem] leading-none text-bone">{artist.display_name}</span>
          <span className="mt-1 block truncate text-[0.85rem] text-bone/80">
            {stop.city}
            {artist.home_city ? ` · ${t.world.card.based.replace("{city}", artist.home_city)}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="p-gothic block text-[1.05rem] leading-tight text-accent">{dateRange(stop.starts_on, stop.ends_on, locale)}</span>
          <span className="p-stamp block text-[0.55rem] text-bone-dim">{t.artist.status[stop.status as "announced" | "booking"] ?? stop.status}</span>
        </span>
      </Link>
    </li>
  );
}
