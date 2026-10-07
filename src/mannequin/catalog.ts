/**
 * Tattoo placement catalog. Zone ids match the `_ZONE` vertex attribute baked
 * into public/mannequin/body-*.glb by tools/mannequin/build.py — never renumber.
 * "L"/"R" are the client's own left and right.
 */

export type Locale = "en" | "es";
export type BodyType = "f" | "m";

export interface AtomicZone {
  id: number;
  slug: string;
  label: Record<Locale, string>;
  /** Largest design that still reads well on this area, in cm. */
  maxCm: number;
  /** Narrow, curved areas: decals project shallower so they don't wrap through the limb. */
  limb: boolean;
}

export interface Placement {
  slug: string;
  label: Record<Locale, string>;
  zones: string[];
  group: PlacementGroup;
  /** Whole-area pieces (sleeves, full back) have no single size to pick. */
  fullCoverage: boolean;
}

export type PlacementGroup = "arms" | "torso" | "back" | "legs" | "head" | "extremities";

const z = (id: number, slug: string, en: string, es: string, maxCm: number, limb = false): AtomicZone => ({
  id,
  slug,
  label: { en, es },
  maxCm,
  limb,
});

export const ZONES: AtomicZone[] = [
  z(1, "neck", "Neck", "Cuello", 12),
  z(2, "nape", "Nape", "Nuca", 12),
  z(3, "shoulder_L", "Left shoulder", "Hombro izquierdo", 20, true),
  z(4, "shoulder_R", "Right shoulder", "Hombro derecho", 20, true),
  z(5, "upper_arm_L", "Left upper arm", "Brazo izquierdo", 25, true),
  z(6, "upper_arm_R", "Right upper arm", "Brazo derecho", 25, true),
  z(7, "forearm_inner_L", "Left inner forearm", "Antebrazo interno izquierdo", 24, true),
  z(8, "forearm_inner_R", "Right inner forearm", "Antebrazo interno derecho", 24, true),
  z(9, "forearm_outer_L", "Left outer forearm", "Antebrazo externo izquierdo", 24, true),
  z(10, "forearm_outer_R", "Right outer forearm", "Antebrazo externo derecho", 24, true),
  z(11, "hand_L", "Left hand", "Mano izquierda", 12, true),
  z(12, "hand_R", "Right hand", "Mano derecha", 12, true),
  z(13, "chest_L", "Left chest", "Pecho izquierdo", 28),
  z(14, "chest_R", "Right chest", "Pecho derecho", 28),
  z(15, "stomach", "Stomach", "Abdomen", 30),
  z(16, "ribs_L", "Left ribs", "Costillas izquierdas", 34),
  z(17, "ribs_R", "Right ribs", "Costillas derechas", 34),
  z(18, "back_upper", "Upper back", "Espalda alta", 45),
  z(19, "back_lower", "Lower back", "Espalda baja", 35),
  z(20, "hip_L", "Left hip", "Cadera izquierda", 20),
  z(21, "hip_R", "Right hip", "Cadera derecha", 20),
  z(22, "thigh_L", "Left thigh", "Muslo izquierdo", 34, true),
  z(23, "thigh_R", "Right thigh", "Muslo derecho", 34, true),
  z(24, "shin_L", "Left shin", "Espinilla izquierda", 28, true),
  z(25, "shin_R", "Right shin", "Espinilla derecha", 28, true),
  z(26, "calf_L", "Left calf", "Pantorrilla izquierda", 28, true),
  z(27, "calf_R", "Right calf", "Pantorrilla derecha", 28, true),
  z(28, "foot_L", "Left foot", "Pie izquierdo", 14, true),
  z(29, "foot_R", "Right foot", "Pie derecho", 14, true),
];

export const ZONE_BY_SLUG = new Map(ZONES.map((zone) => [zone.slug, zone]));
export const ZONE_BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));

const atomicGroup: Record<string, PlacementGroup> = {
  neck: "head",
  nape: "head",
  shoulder: "arms",
  upper_arm: "arms",
  forearm_inner: "arms",
  forearm_outer: "arms",
  hand: "extremities",
  chest: "torso",
  stomach: "torso",
  ribs: "torso",
  hip: "torso",
  back_upper: "back",
  back_lower: "back",
  thigh: "legs",
  shin: "legs",
  calf: "legs",
  foot: "extremities",
};

const groupOf = (slug: string): PlacementGroup => atomicGroup[slug.replace(/_[LR]$/, "")];

const composite = (slug: string, en: string, es: string, zones: string[], group: PlacementGroup): Placement => ({
  slug,
  label: { en, es },
  zones,
  group,
  fullCoverage: true,
});

const sided = (base: string, en: string, es: string, parts: string[], group: PlacementGroup): Placement[] => [
  composite(`${base}_L`, `${en} (left)`, `${es} (izquierda)`, parts.map((p) => `${p}_L`), group),
  composite(`${base}_R`, `${en} (right)`, `${es} (derecha)`, parts.map((p) => `${p}_R`), group),
];

export const PLACEMENTS: Placement[] = [
  ...ZONES.map<Placement>((zone) => ({
    slug: zone.slug,
    label: zone.label,
    zones: [zone.slug],
    group: groupOf(zone.slug),
    fullCoverage: false,
  })),
  ...sided("sleeve_full", "Full sleeve", "Manga completa", ["shoulder", "upper_arm", "forearm_inner", "forearm_outer"], "arms"),
  ...sided("sleeve_half", "Half sleeve", "Media manga", ["shoulder", "upper_arm"], "arms"),
  ...sided("forearm_full", "Full forearm", "Antebrazo completo", ["forearm_inner", "forearm_outer"], "arms"),
  composite("chest_full", "Chest piece", "Pecho completo", ["chest_L", "chest_R"], "torso"),
  composite("back_full", "Full back", "Espalda completa", ["back_upper", "back_lower"], "back"),
  ...sided("leg_sleeve", "Leg sleeve", "Pierna completa", ["thigh", "shin", "calf"], "legs"),
];

export const PLACEMENT_BY_SLUG = new Map(PLACEMENTS.map((p) => [p.slug, p]));

export const GROUP_LABELS: Record<PlacementGroup, Record<Locale, string>> = {
  arms: { en: "Arms", es: "Brazos" },
  torso: { en: "Chest & torso", es: "Pecho y torso" },
  back: { en: "Back", es: "Espalda" },
  legs: { en: "Legs", es: "Piernas" },
  head: { en: "Neck", es: "Cuello" },
  extremities: { en: "Hands & feet", es: "Manos y pies" },
};

export const BODY_HEIGHT_CM: Record<BodyType, number> = { f: 167, m: 178 };
export const MIN_DESIGN_CM = 3;

/** The atomic zone a single-area placement points at, for size limits. */
export function maxSizeFor(placementSlug: string): number {
  const placement = PLACEMENT_BY_SLUG.get(placementSlug);
  if (!placement) return 20;
  return Math.max(...placement.zones.map((s) => ZONE_BY_SLUG.get(s)?.maxCm ?? 20));
}

export type SizeBand = "small" | "medium" | "large" | "xl";

export function sizeBand(cm: number): SizeBand {
  if (cm <= 6) return "small";
  if (cm <= 12) return "medium";
  if (cm <= 22) return "large";
  return "xl";
}
