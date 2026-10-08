import type { Locale } from "@/i18n";

type L = Record<Locale, string>;

export const STYLES: { slug: string; label: L; hint: L }[] = [
  { slug: "realism", label: { en: "Realism", es: "Realismo" }, hint: { en: "Portraits, nature, true-to-life detail", es: "Retratos, naturaleza, detalle fiel a la realidad" } },
  { slug: "surrealism", label: { en: "Surrealism", es: "Surrealismo" }, hint: { en: "Dreamlike scenes and impossible blends", es: "Escenas oníricas y fusiones imposibles" } },
  { slug: "fine_line", label: { en: "Fine line", es: "Fine line" }, hint: { en: "Delicate single-needle work", es: "Trazo fino y delicado" } },
  { slug: "blackwork", label: { en: "Blackwork", es: "Blackwork" }, hint: { en: "Solid black, bold contrast", es: "Negro sólido, contraste fuerte" } },
  { slug: "neo_traditional", label: { en: "Neo-traditional", es: "Neotradicional" }, hint: { en: "Bold lines, rich colour, ornament", es: "Líneas firmes, color rico, ornamento" } },
  { slug: "traditional", label: { en: "Traditional", es: "Tradicional" }, hint: { en: "Classic flash, thick lines", es: "Flash clásico, línea gruesa" } },
  { slug: "japanese", label: { en: "Japanese", es: "Japonés" }, hint: { en: "Irezumi motifs and large flow", es: "Motivos irezumi y composiciones grandes" } },
  { slug: "illustrative", label: { en: "Illustrative", es: "Ilustrativo" }, hint: { en: "Drawn, painterly, sketch-like", es: "Dibujado, pictórico, tipo boceto" } },
  { slug: "lettering", label: { en: "Lettering", es: "Lettering" }, hint: { en: "Script, words and dates", es: "Letras, palabras y fechas" } },
  { slug: "other", label: { en: "Something else", es: "Otro estilo" }, hint: { en: "Describe it in your idea", es: "Descríbelo en tu idea" } },
];

export const STYLE_BY_SLUG = new Map(STYLES.map((s) => [s.slug, s]));

export const COLOR_MODES: { slug: "black_grey" | "color" | "undecided"; label: L }[] = [
  { slug: "black_grey", label: { en: "Black & grey", es: "Negro y gris" } },
  { slug: "color", label: { en: "Colour", es: "Color" } },
  { slug: "undecided", label: { en: "Not sure yet", es: "Aún no lo sé" } },
];

export const styleLabel = (slug: string | null | undefined, locale: Locale) =>
  (slug && STYLE_BY_SLUG.get(slug)?.label[locale]) ?? slug ?? "";

export const colorLabel = (slug: string | null | undefined, locale: Locale) =>
  COLOR_MODES.find((c) => c.slug === slug)?.label[locale] ?? "";

/** Budget brackets offered to clients, in cents. The artist's minimum trims the list. */
export const BUDGETS: [number, number | null][] = [
  [20000, 50000],
  [50000, 100000],
  [100000, 200000],
  [200000, 400000],
  [400000, null],
];

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Lisbon",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/* ------------------------------------------------------------------ trades */

export type Trade = "tattoo" | "barber" | "graffiti";
export type BookingMode = "brief_quote" | "slots" | "project";

/** The trades the world can hold. Only tattoo is live; the others are real categories with an empty state. */
export const TRADES: { slug: Trade; label: L; plural: L; bookingMode: BookingMode; live: boolean }[] = [
  { slug: "tattoo", label: { en: "Tattoo", es: "Tatuaje" }, plural: { en: "Tattoo artists", es: "Tatuadores" }, bookingMode: "brief_quote", live: true },
  { slug: "barber", label: { en: "Barber", es: "Barbería" }, plural: { en: "Barbers", es: "Barberos" }, bookingMode: "slots", live: false },
  { slug: "graffiti", label: { en: "Graffiti & murals", es: "Graffiti y murales" }, plural: { en: "Muralists", es: "Muralistas" }, bookingMode: "project", live: false },
];
export const TRADE_BY_SLUG = new Map(TRADES.map((t) => [t.slug, t]));
export const isTrade = (s: unknown): s is Trade => typeof s === "string" && TRADE_BY_SLUG.has(s as Trade);
