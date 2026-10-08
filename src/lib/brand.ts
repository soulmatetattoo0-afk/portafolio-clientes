/**
 * The house brand. Vanta: the blackest black, the ink and the page. One
 * place to change if the name moves.
 */
export const BRAND = {
  name: "VANTA",
  /** The brand line. */
  tagline: { en: "Find your artist.", es: "Encuentra a tu artista." },
  /** The AI as a post on the masthead, for the colophon; never on the cover. */
  editor: { en: "An AI at the editor's desk. A human on the cover.", es: "Una IA en la mesa del editor. Un humano en la portada." },
  instagram: "vanta.world",
  /** The house accent for every world page; an artist's own accent only ever colours one lead element. */
  accent: "#d8552f",
} as const;
