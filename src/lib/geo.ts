/**
 * Where a city is, as one place to ask. The gazetteer lives with the map
 * (experience/cities.ts); this adds the slug the world pages route on, the
 * country key, and the distance the search sorts by. Unknown cities are not
 * pinned; they stay searchable by name.
 */
import { locate } from "@/app/[artist]/experience/cities";

export { locate };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "Ciudad de México" → "ciudad-de-mexico"; "Brooklyn, NY" → "brooklyn". */
export function citySlug(city: string): string {
  return fold(city)
    .split(",")[0]
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COUNTRY_ALIAS: Record<string, string> = {
  usa: "united states", "u.s.": "united states", us: "united states", "estados unidos": "united states", "eeuu": "united states", "ee.uu.": "united states",
  uk: "united kingdom", "reino unido": "united kingdom", england: "united kingdom", inglaterra: "united kingdom",
  mexico: "mexico", "méxico": "mexico", espana: "spain", "españa": "spain", alemania: "germany", deutschland: "germany",
  francia: "france", italia: "italy", brasil: "brazil", "república argentina": "argentina",
};

/** A country as people write it, folded to one key the map and the search agree on. */
export function countryKey(country: string | null | undefined): string | null {
  if (!country) return null;
  const f = fold(country);
  return COUNTRY_ALIAS[f] ?? f;
}

export interface Place {
  city_slug: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
}

/** The columns the app writes beside a city name, so search and the map need no geocoder. */
export function placeCity(city: string, country?: string | null): Place {
  const at = locate(city);
  return { city_slug: citySlug(city), country: country?.trim() || null, lat: at ? at[0] : null, lng: at ? at[1] : null };
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A city name back from its slug, for headings when no row carries the pretty name. */
export function cityName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
