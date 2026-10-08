import { COUNTRY_BOX, STATES, US_BOX, type StateShape } from "./regions";
import { PROJ, WORLD_H, WORLD_W } from "./world";

/** A viewBox: x, y, width, height in world units. */
export type Box = [number, number, number, number];

export interface Frame {
  box: Box;
  /** What the map draws under the pins once it has zoomed: the states, the borders between countries, or just the land. */
  layer: "states" | "borders" | "world";
}

export const WORLD_FRAME: Frame = { box: [0, 0, WORLD_W, WORLD_H], layer: "world" };

/** Natural Earth, the same projection the land path was drawn in. */
export function project(lat: number, lon: number): [number, number] {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const p2 = p * p;
  const p4 = p2 * p2;
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [PROJ.tx + PROJ.k * x, PROJ.ty - PROJ.k * y];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .trim();

/** How artists write a country, in English or Spanish, to its Natural Earth name. */
const ALIAS: Record<string, string> = {};
for (const [name, aliases] of Object.entries({
  "united states of america": ["united states", "usa", "us", "eeuu", "ee uu", "estados unidos", "america"],
  "united kingdom": ["uk", "england", "great britain", "britain", "scotland", "wales", "reino unido", "inglaterra", "escocia", "gran bretana"],
  mexico: ["mexico"],
  spain: ["espana"],
  italy: ["italia"],
  germany: ["alemania", "deutschland"],
  france: ["francia"],
  brazil: ["brasil"],
  netherlands: ["holland", "holanda", "paises bajos", "the netherlands"],
  japan: ["japon"],
  canada: [],
  switzerland: ["suiza"],
  belgium: ["belgica"],
  sweden: ["suecia"],
  norway: ["noruega"],
  denmark: ["dinamarca"],
  ireland: ["irlanda"],
  poland: ["polonia"],
  czechia: ["czech republic", "republica checa"],
  greece: ["grecia"],
  turkey: ["turquia", "turkiye"],
  "south korea": ["korea", "corea", "corea del sur"],
  thailand: ["tailandia"],
  "new zealand": ["nueva zelanda"],
  "south africa": ["sudafrica"],
  "united arab emirates": ["uae", "emiratos arabes unidos", "dubai"],
  egypt: ["egipto"],
  morocco: ["marruecos"],
  philippines: ["filipinas"],
  panama: [],
  peru: [],
  "dominican rep.": ["dominican republic", "republica dominicana"],
  russia: ["rusia"],
  hungary: ["hungria"],
  finland: ["finlandia"],
})) {
  ALIAS[name] = name;
  for (const a of aliases) ALIAS[a] = name;
}

/** The Natural Earth name for a country as the artist wrote it, or the folded text itself. */
export function countryKey(country: string): string {
  const f = fold(country);
  return ALIAS[f] ?? f;
}

type Continent = "europe" | "asia" | "oceania" | "africa" | "south america" | "north america" | "other";

function continentOf(lat: number, lon: number): Continent {
  if (lon >= -25 && lon <= 45 && lat >= 34.5 && lat <= 72) return "europe";
  if (lon >= 110 && lat < -11) return "oceania";
  if ((lon >= 34 && lat >= 12) || (lon >= 60 && lat >= -11)) return "asia";
  if (lon >= -20 && lon <= 52 && lat >= -36 && lat <= 37.5) return "africa";
  if (lon >= -82 && lon <= -32 && lat >= -57 && lat <= 12.6) return "south america";
  if (lon >= -170 && lon <= -50 && lat >= 7 && lat <= 84) return "north america";
  return "other";
}

type Bounds = [number, number, number, number];

const union = (a: Bounds, b: Bounds): Bounds => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/** Pads a bounds rectangle, gives it a floor size, and settles its shape between a wide and a squarer map. */
function settle(b: Bounds, minW: number): Box {
  let w = Math.max(b[2] - b[0], minW);
  let h = Math.max(b[3] - b[1], minW * 0.52);
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  w *= 1.22;
  h *= 1.3;
  const aspect = Math.min(1.92, Math.max(1.25, w / h));
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  // Stay inside the world.
  w = Math.min(w, WORLD_W);
  h = Math.min(h, WORLD_H);
  const x = Math.min(Math.max(cx - w / 2, 0), WORLD_W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), WORLD_H - h);
  return [x, y, w, h];
}

export interface Place {
  lat: number;
  lon: number;
  country: string;
}

/**
 * The frame rule. One country: that country, with the US drawn state by state.
 * One continent: the stops themselves, framed with room around them. Spread over
 * continents, or nothing to show: the whole world.
 */
export function frameOf(places: Place[]): Frame {
  if (places.length === 0) return WORLD_FRAME;
  const pts = places.map((p) => project(p.lat, p.lon));
  const pinBounds = pts.reduce<Bounds>((b, [x, y]) => union(b, [x, y, x, y]), [Infinity, Infinity, -Infinity, -Infinity]);
  const keys = new Set(places.map((p) => countryKey(p.country)));
  if (keys.size === 1) {
    const key = [...keys][0];
    if (key === "united states of america") return { box: settle(union(US_BOX, pinBounds), 140), layer: "states" };
    const cb = COUNTRY_BOX[key];
    if (cb) return { box: settle(union(cb, pinBounds), 60), layer: "borders" };
  }
  const continents = new Set(places.map((p) => continentOf(p.lat, p.lon)));
  if (continents.size === 1 && !continents.has("other")) return { box: settle(pinBounds, 120), layer: "borders" };
  return WORLD_FRAME;
}

/** The geometry of a state path, parsed once: its rings as flat [x, y, x, y, ...] arrays. */
const rings = new Map<string, number[][]>();

function ringsOf(s: StateShape): number[][] {
  let r = rings.get(s.id);
  if (r) return r;
  r = [];
  for (const m of s.d.matchAll(/M([^MZ]*)Z/g)) {
    const ring = m[1]
      .split(/[ML,]/)
      .filter(Boolean)
      .map(Number);
    if (ring.length >= 6) r.push(ring);
  }
  rings.set(s.id, r);
  return r;
}

function inRing(ring: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The state a projected point falls in, or null. */
export function stateAt(x: number, y: number): StateShape | null {
  for (const s of STATES) {
    if (x < s.box[0] || x > s.box[2] || y < s.box[1] || y > s.box[3]) continue;
    if (ringsOf(s).some((r) => inRing(r, x, y))) return s;
  }
  return null;
}

/** Where a point outside the box shows up on its edge: the ray from the centre, stopped `inset` short of the border. */
export function edgePoint(box: Box, [px, py]: [number, number], inset: number): [number, number] {
  const cx = box[0] + box[2] / 2;
  const cy = box[1] + box[3] / 2;
  const dx = px - cx;
  const dy = py - cy;
  const hx = box[2] / 2 - inset;
  const hy = box[3] / 2 - inset;
  const t = Math.min(hx / Math.max(Math.abs(dx), 1e-6), hy / Math.max(Math.abs(dy), 1e-6));
  return [cx + dx * t, cy + dy * t];
}

export const inBox = (box: Box, [x, y]: [number, number]) => x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3];
