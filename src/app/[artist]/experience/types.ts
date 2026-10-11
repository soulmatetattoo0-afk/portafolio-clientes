import type { Dict, Locale } from "@/i18n";
import type { Magazine } from "@/lib/magazine-server";
import type { Artist, ArtistCard, FlashItem, PortfolioItem, TourStop } from "@/lib/queries";

export type PanelId = "bio" | "work" | "flash" | "book" | "spots";
export const PANELS: PanelId[] = ["bio", "work", "flash", "spots", "book"];

export interface ExperienceData {
  artist: Artist;
  stops: TourStop[];
  portfolio: PortfolioItem[];
  flash: FlashItem[];
  /** Cities the public is asking the artist to visit, biggest first. */
  demand: { city: string; n: number }[];
  /** Days already taken on each stop (by stop id), as ISO dates on the stop's clock. */
  taken: Record<string, string[]>;
  /** Whether the signed-in client follows this artist; null when signed out. */
  following: boolean | null;
  /** Artists like this one, for the "more like" rows. */
  related: ArtistCard[];
  /** The artist's own magazine, laid out in the studio. */
  magazine: Magazine;
  locale: Locale;
  t: Dict;
  demo: boolean;
}

/** Accent from the artist row, or the house default. */
export const accentOf = (artist: Artist) => artist.accent ?? "#d8552f";

/** The cover word: the artist's own, else the first speciality, else the name. */
export function coverWordOf(artist: Artist, fallback: string) {
  return (artist.cover_word?.trim() || fallback || artist.display_name.split(" ")[0]).toUpperCase();
}
