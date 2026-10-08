import Link from "next/link";

import { dict, fill, type Locale } from "@/i18n";
import { STYLE_BY_SLUG, TRADE_BY_SLUG } from "@/lib/catalog";
import { money, requestTime } from "@/lib/format";
import type { ArtistCard as Card } from "@/lib/queries";

import { CoverPlate } from "./CoverPlate";
import { SaveButton } from "./SaveButton";
import { SpotBadge } from "./SpotBadge";

const DAY = 86400000;
/** Days until a date, from today, in whole days. */
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00Z`).getTime() - requestTime()) / DAY);

/**
 * One artist, as a poster you can tap: the portrait (or the typeset plate),
 * the name, the styles, the city and the price from. The card wears the
 * accent of the page it sits on; only a section's lead card is handed the
 * artist's own (`lead`). `why` is a reason in words, never a number.
 */
export function ArtistCard({
  artist,
  locale,
  following,
  why,
  compact = false,
  lead = false,
  priority = false,
}: {
  artist: Card;
  locale: Locale;
  /** undefined: no save button; null: signed out; boolean: the state. */
  following?: boolean | null;
  why?: string;
  compact?: boolean;
  lead?: boolean;
  priority?: boolean;
}) {
  const c = dict(locale).world.card;
  const styles = artist.styles.map((s) => STYLE_BY_SLUG.get(s)?.label[locale] ?? s);
  const trade = TRADE_BY_SLUG.get(artist.trade)?.label[locale] ?? artist.trade;
  const stop = artist.next_stop;
  const soon = stop?.starts_on && daysUntil(stop.starts_on) <= 60 && daysUntil(stop.starts_on) >= -30 ? stop : null;
  const price = artist.price_from_cents != null ? fill(c.from, { price: money(artist.price_from_cents, artist.currency, locale) }) : null;
  const dots = [
    artist.has_color && { key: "color", label: c.color, cls: "bg-accent" },
    artist.has_black_grey && { key: "bg", label: c.blackGrey, cls: "bg-bone" },
    artist.has_healed && { key: "healed", label: c.healed, cls: "border border-bone bg-transparent" },
  ].filter(Boolean) as { key: string; label: string; cls: string }[];
  const style = lead && artist.accent ? ({ "--accent": artist.accent } as React.CSSProperties) : undefined;

  if (compact)
    return (
      <article className="relative w-[9rem] shrink-0 snap-start" style={style}>
        <Link href={`/${artist.slug}`} className="group block overflow-hidden rounded-[14px] border border-line bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
          <div className="relative aspect-[3/4] overflow-hidden [container-type:inline-size]">
            {artist.portrait_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.portrait_url} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover object-top ${artist.cover_poster ? "" : "grayscale"}`} />
            ) : (
              <CoverPlate name={artist.display_name} compact />
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            <div className="absolute right-2.5 bottom-2.5 left-2.5">
              <p className="p-display text-[1.15rem] leading-[0.95] text-bone">{artist.display_name}</p>
              {artist.home_city && <p className="p-stamp mt-1 truncate text-[0.55rem] text-bone/70">{artist.home_city}</p>}
            </div>
          </div>
        </Link>
      </article>
    );

  return (
    <article className="relative" style={style}>
      <Link href={`/${artist.slug}`} className="group block overflow-hidden rounded-[16px] border border-line bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
        <div className="relative aspect-[3/4] overflow-hidden [container-type:inline-size]">
          {artist.portrait_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.portrait_url} alt="" loading={priority ? "eager" : "lazy"} className={`absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03] ${artist.cover_poster ? "" : "grayscale"}`} />
          ) : (
            <CoverPlate name={artist.display_name} />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />

          {/* top left: the trade, then the next stop when it is close */}
          <div className="absolute top-2.5 left-2.5 flex max-w-[calc(100%-3.75rem)] flex-col items-start gap-1.5">
            <span className="p-stamp rounded-full bg-ink/70 px-2 py-1 text-[0.55rem] text-bone backdrop-blur-sm">{trade}</span>
            {soon && <SpotBadge city={soon.city} start={soon.starts_on} end={soon.ends_on} locale={locale} className="max-w-full" />}
          </div>

          <div className="absolute right-2.5 bottom-2.5 left-2.5">
            <h3 className="p-display text-[clamp(1.3rem,13cqw,1.9rem)] leading-[0.92] text-bone">{artist.display_name}</h3>
            <p className={`mt-1.5 text-[0.78rem] leading-snug text-bone/80 ${why ? "line-clamp-2" : "line-clamp-1"}`}>{why ?? styles.join(" · ")}</p>
            <p className="p-stamp mt-2 flex items-center justify-between gap-2 text-[0.54rem] tracking-[0.16em] text-bone/70">
              <span className="truncate">{artist.home_city ?? ""}</span>
              {price && <span className="shrink-0">{price}</span>}
            </p>
            {dots.length > 0 && (
              <ul className="mt-2 flex items-center gap-1.5" aria-label={dots.map((d) => d.label).join(", ")}>
                {dots.map((d) => (
                  <li key={d.key} className={`h-2 w-2 rounded-full ${d.cls}`} title={d.label}>
                    <span className="sr-only">{d.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Link>
      {following !== undefined && (
        <div className="absolute top-2.5 right-2.5">
          <SaveButton artistId={artist.id} following={following} labels={{ save: fill(c.save, { name: artist.display_name }), saved: c.saved, signIn: fill(c.signInToSave, { name: artist.display_name }) }} />
        </div>
      )}
    </article>
  );
}
