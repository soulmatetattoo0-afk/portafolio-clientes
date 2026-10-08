/**
 * What each tier can do. Basic is free: a page, a gallery, a listing, an
 * inbox, and quotes with deposits that carry the platform fee. Full removes
 * the fee and opens the rest. Founding and the earlier plans count as full.
 */
export type Plan = "basic" | "full" | "founding" | "artist" | "pro" | "studio";
export type Feature = "no_fee" | "flash" | "spots" | "magazine" | "submit" | "alerts_fanout";

export const isFull = (plan: string | null | undefined) => plan !== "basic";

export function can(plan: string | null | undefined, feature: Feature): boolean {
  void feature; // every gated feature is "full only" today; the switch stays for the day a feature splits
  return isFull(plan);
}

/** Basis points of platform fee a deposit carries for this plan. */
export function feeBpsFor(plan: string | null | undefined, platformFeeBps: number): number {
  return can(plan, "no_fee") ? 0 : platformFeeBps;
}
