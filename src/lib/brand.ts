/**
 * The house brand: the name on every magazine's masthead and the line that
 * says who makes it. One place to change when the name is settled.
 */
export const BRAND = {
  name: "INKFOLIO",
  /** Under the masthead, in small caps. */
  tagline: { en: "Art · Skin · Stories", es: "Arte · Piel · Historias" },
  /** The AI as the editor-in-chief, said plainly. */
  madeBy: { en: "Edited by AI", es: "Editada por IA" },
  instagram: "inkfolio",
} as const;
