import type { ExperienceData } from "./types";
import type { Pin } from "./WorldMap";

/** Home, every tour stop, and the cities asking: what lights up on the map. */
export function pinsOf(data: ExperienceData): Pin[] {
  const stops: Pin[] = data.stops.map((s) => ({ city: s.city, kind: s.is_home ? "home" : "stop" }));
  if (!stops.some((p) => p.kind === "home") && data.artist.home_city) stops.unshift({ city: data.artist.home_city, kind: "home" });
  const named = new Set(stops.map((p) => p.city.toLowerCase()));
  const demand: Pin[] = data.demand.filter((d) => !named.has(d.city.toLowerCase())).map((d) => ({ city: d.city, kind: "demand", weight: d.n }));
  return [...stops, ...demand];
}
