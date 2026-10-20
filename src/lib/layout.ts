import { z } from "zod";

/**
 * The front's buttons, as their owner arranged them: which ones, in what
 * order, and how big. The screen is a two-column grid that always fills one
 * phone screen; a button spans one or two columns and one to three rows, and
 * the rows share the height between them.
 */
export const TILE_KINDS = ["mag", "book", "cal", "work", "artists", "join"] as const;
export type TileKind = (typeof TILE_KINDS)[number];

export const TileSchema = z.object({
  kind: z.enum(TILE_KINDS),
  w: z.union([z.literal(1), z.literal(2)]),
  h: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type Tile = z.infer<typeof TileSchema>;
export const LayoutSchema = z.array(TileSchema).min(1).max(8);

/** Which buttons each kind of front can have. */
export const KINDS_FOR = {
  artist: ["mag", "book", "cal", "work"] as TileKind[],
  studio: ["mag", "book", "artists", "work", "join", "cal"] as TileKind[],
};

export const DEFAULT_LAYOUT: Record<"artist" | "studio", Tile[]> = {
  artist: [
    { kind: "work", w: 2, h: 3 },
    { kind: "mag", w: 1, h: 2 },
    { kind: "cal", w: 1, h: 2 },
    { kind: "book", w: 2, h: 1 },
  ],
  studio: [
    { kind: "mag", w: 2, h: 3 },
    { kind: "book", w: 1, h: 2 },
    { kind: "artists", w: 1, h: 1 },
    { kind: "join", w: 1, h: 1 },
    { kind: "work", w: 2, h: 1 },
  ],
};

/** The saved layout if it is valid for this front, else the default. Unknown or repeated buttons are dropped. */
export function layoutOf(saved: unknown, front: "artist" | "studio"): Tile[] {
  const parsed = LayoutSchema.safeParse(saved);
  if (!parsed.success) return DEFAULT_LAYOUT[front];
  const seen = new Set<TileKind>();
  const tiles = parsed.data.filter((t) => KINDS_FOR[front].includes(t.kind) && !seen.has(t.kind) && seen.add(t.kind));
  return tiles.length ? tiles : DEFAULT_LAYOUT[front];
}

/**
 * Where each tile lands on a two-column grid, filling row by row and taking
 * the first gap that fits (what CSS's dense flow does), and how many rows
 * that takes. The screen divides its height by that count.
 */
export function placeTiles(tiles: Tile[]): { rows: number; spots: { col: number; row: number }[] } {
  const filled: boolean[][] = [];
  const free = (r: number, c: number) => !(filled[r]?.[c] ?? false);
  const spots: { col: number; row: number }[] = [];
  for (const t of tiles) {
    let placed = false;
    for (let r = 0; !placed; r++) {
      for (let c = 0; c + t.w <= 2 && !placed; c++) {
        let ok = true;
        for (let dr = 0; dr < t.h && ok; dr++) for (let dc = 0; dc < t.w && ok; dc++) ok = free(r + dr, c + dc);
        if (!ok) continue;
        for (let dr = 0; dr < t.h; dr++) for (let dc = 0; dc < t.w; dc++) (filled[r + dr] ??= [])[c + dc] = true;
        spots.push({ col: c + 1, row: r + 1 });
        placed = true;
      }
    }
  }
  return { rows: filled.length, spots };
}
