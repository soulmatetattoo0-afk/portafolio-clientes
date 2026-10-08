import type { ExperienceData } from "./types";
import type { Pin } from "./WorldMap";

/**
 * What lights up on the map: the home and every guest spot, nothing else. Where
 * people are asking the artist to come stays a list under the map.
 */
export function pinsOf(data: ExperienceData): Pin[] {
  const pins: Pin[] = data.stops.map((s) => ({ id: s.id, city: s.city, country: s.country, kind: s.is_home ? "home" : "stop", on: s.starts_on }));
  if (!pins.some((p) => p.kind === "home") && data.artist.home_city) pins.unshift({ id: "home", city: data.artist.home_city, country: "", kind: "home", on: null });
  return pins;
}
