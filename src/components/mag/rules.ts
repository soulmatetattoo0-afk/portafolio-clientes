/**
 * The rules of the magazine's page order. Shared by the artist magazine and
 * the issue reader so both turn pages the same way.
 */

export type Tone = "ink" | "bone";

/** The paper of the next page: ink after bone, bone after ink; a full-bleed photograph is ink. */
export const after = (tone: Tone, kind: string): Tone => (kind === "bleed" ? "ink" : tone === "ink" ? "bone" : "ink");

/** Where to crop a photograph when it has to lose something: faces and backs keep the top. */
export function posOf(piece: { placement?: string | null }): "top" | "center" {
  return /back|chest|neck|head|face|sleeve|arm|forearm|shoulder/.test(piece.placement ?? "") ? "top" : "center";
}
