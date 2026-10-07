import type { Dict, Locale } from "@/i18n";
import type { Artist, FlashItem, PortfolioItem, TourStop } from "@/lib/queries";

export type PanelId = "bio" | "work" | "flash" | "book" | "spots";
export const PANELS: PanelId[] = ["bio", "work", "flash", "book", "spots"];

export interface ExperienceData {
  artist: Artist;
  stops: TourStop[];
  portfolio: PortfolioItem[];
  flash: FlashItem[];
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
