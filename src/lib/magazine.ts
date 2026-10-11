import { z } from "zod";

/**
 * The artist's own magazine: a cover and pages the artist lays out by hand.
 * Every page is a fixed 2:3 sheet; boxes are placed in percent of that sheet,
 * so a layout looks the same on a phone and on a desktop. A box is either a
 * frame (a photo or a video) or a block of text.
 *
 * Text a box was born with but nobody has written yet carries a `ph` key
 * instead of words: it renders the generic prompt in the reader's language.
 */

export const PAGE_RATIO = 2 / 3;
/** The printable area: nothing may sit closer than this to the edge (percent). */
export const SAFE = 4;
/** On the cover the masthead and the title line are ours; boxes live below them. */
export const COVER_TOP = 24;
export const MAX_PAGES = 24;
export const MAX_BOXES = 24;

export const FONTS = ["poster", "roman", "serif", "italic", "gothic", "script", "sans"] as const;
export type FontId = (typeof FONTS)[number];
/** Each face, as the CSS family it maps to. */
export const FONT_FAMILY: Record<FontId, string> = {
  poster: "var(--font-poster)",
  roman: "var(--font-display)",
  serif: "var(--font-serif)",
  italic: "var(--font-quote)",
  gothic: "var(--font-gothic)",
  script: "var(--font-script)",
  sans: "var(--font-sans)",
};
/** The face's own weight and case, so each one looks like itself. */
export const FONT_STYLE: Record<FontId, React.CSSProperties> = {
  poster: { fontWeight: 900, textTransform: "uppercase", lineHeight: 0.92, letterSpacing: "0.005em" },
  roman: { fontWeight: 600, textTransform: "uppercase", lineHeight: 1.05, letterSpacing: "0.08em" },
  serif: { fontWeight: 500, lineHeight: 1.12 },
  italic: { fontStyle: "italic", lineHeight: 1.18 },
  gothic: { lineHeight: 1.05 },
  script: { lineHeight: 1.15 },
  sans: { fontWeight: 400, lineHeight: 1.45 },
};

export const PLACEHOLDERS = ["title", "kicker", "bio", "caption", "quote", "coverTitle", "coverLine"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

const pct = z.number().finite().min(0).max(100);

export const BoxSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["media", "text"]),
  x: pct,
  y: pct,
  w: z.number().finite().min(4).max(100),
  h: z.number().finite().min(3).max(100),
  // frame
  src: z.string().max(400).nullish(),
  video: z.boolean().optional(),
  zoom: z.number().finite().min(1).max(4).optional(),
  fx: pct.optional(),
  fy: pct.optional(),
  // text
  text: z.string().max(4000).optional(),
  ph: z.enum(PLACEHOLDERS).optional(),
  font: z.enum(FONTS).optional(),
  size: z.number().finite().min(1.5).max(40).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  dir: z.enum(["h", "v", "up"]).optional(),
  rotate: z.number().finite().min(-180).max(180).optional(),
  color: z.enum(["bone", "ink", "accent"]).optional(),
});
export type MagBox = z.infer<typeof BoxSchema>;

export const PageSchema = z.object({
  id: z.string().min(1).max(40),
  tone: z.enum(["ink", "bone"]),
  boxes: z.array(BoxSchema).max(MAX_BOXES),
});
export type MagPage = z.infer<typeof PageSchema>;

export const CoverSchema = z.object({
  /** compose: lay the cover out with boxes. poster: one finished image, the masthead stamped on it. */
  mode: z.enum(["compose", "poster"]),
  poster: z.string().max(400).nullish(),
  zoom: z.number().finite().min(1).max(4).optional(),
  fx: pct.optional(),
  fy: pct.optional(),
  tone: z.enum(["ink", "bone"]),
  boxes: z.array(BoxSchema).max(MAX_BOXES),
});
export type MagCover = z.infer<typeof CoverSchema>;

export const DocSchema = z.object({
  v: z.literal(1),
  cover: CoverSchema,
  pages: z.array(PageSchema).min(1).max(MAX_PAGES),
});
export type MagDoc = z.infer<typeof DocSchema>;

let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Keep a box inside the printable area of its page (the cover keeps its masthead clear). */
export function clampBox(b: MagBox, cover = false): MagBox {
  const top = cover ? COVER_TOP : SAFE;
  const maxW = 100 - SAFE * 2;
  const maxH = 100 - SAFE - top;
  const w = Math.min(Math.max(b.w, 4), maxW);
  const h = Math.min(Math.max(b.h, 3), maxH);
  const x = Math.min(Math.max(b.x, SAFE), 100 - SAFE - w);
  const y = Math.min(Math.max(b.y, top), 100 - SAFE - h);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { ...b, x: r(x), y: r(y), w: r(w), h: r(h) };
}

export const frame = (src: string | null, x: number, y: number, w: number, h: number, extra: Partial<MagBox> = {}): MagBox => ({ id: newId(), kind: "media", x, y, w, h, src, zoom: 1, fx: 50, fy: 50, ...extra });
export const words = (ph: Placeholder, x: number, y: number, w: number, h: number, extra: Partial<MagBox> = {}): MagBox => ({
  id: newId(), kind: "text", x, y, w, h, ph, text: "", font: "sans", size: 3.6, align: "left", dir: "h", rotate: 0, color: "bone", ...extra,
});

/**
 * The starting magazine: a composed cover and a run of page layouts with the
 * artist's own photographs dropped into the frames, every text box a prompt
 * waiting for their words. Photos are cycled if there are fewer than frames.
 */
export function starterDoc(photos: string[], cover: string | null, portrait: string | null): MagDoc {
  let i = 0;
  const next = () => (photos.length ? photos[i++ % photos.length] : null);
  const page = (tone: "ink" | "bone", boxes: MagBox[]): MagPage => ({ id: newId(), tone, boxes });
  return {
    v: 1,
    cover: {
      mode: "compose",
      tone: "ink",
      poster: null,
      boxes: [
        frame(cover ?? next(), 4, 24, 92, 60, { fy: 30 }),
        words("coverLine", 4, 86, 92, 10, { font: "italic", size: 4.2, align: "center" }),
      ],
    },
    pages: [
      // The artist: portrait, the name of the page, the biography.
      page("ink", [
        words("kicker", 4, 5, 60, 4, { font: "sans", size: 2.4, color: "accent" }),
        words("title", 4, 10, 92, 12, { font: "poster", size: 11 }),
        frame(portrait ?? next(), 4, 25, 50, 46, { fy: 25 }),
        words("bio", 58, 25, 38, 46, { font: "serif", size: 3.4 }),
        words("quote", 4, 76, 92, 18, { font: "italic", size: 5.2 }),
      ]),
      // One piece, full page, its caption at the foot.
      page("ink", [
        frame(next(), 4, 4, 92, 78),
        words("caption", 4, 84, 92, 12, { font: "sans", size: 3 }),
      ]),
      // Two pieces side by side, one long caption, a title.
      page("bone", [
        words("title", 4, 4, 92, 10, { font: "roman", size: 7, color: "ink", align: "center" }),
        frame(next(), 4, 16, 45, 58),
        frame(next(), 51, 16, 45, 58),
        words("caption", 4, 77, 92, 19, { font: "serif", size: 3.4, color: "ink" }),
      ]),
      // A tall piece on the left, the words running up the right edge.
      page("ink", [
        frame(next(), 4, 4, 62, 92),
        words("title", 70, 4, 12, 92, { font: "gothic", size: 8, dir: "v", color: "accent" }),
        words("caption", 84, 4, 12, 92, { font: "sans", size: 2.6, dir: "v" }),
      ]),
      // A contact sheet of four, a short caption.
      page("ink", [
        frame(next(), 4, 4, 45, 38),
        frame(next(), 51, 4, 45, 38),
        frame(next(), 4, 44, 45, 38),
        frame(next(), 51, 44, 45, 38),
        words("caption", 4, 85, 92, 11, { font: "sans", size: 3 }),
      ]),
      // A pull quote over a wide photograph.
      page("bone", [
        frame(next(), 4, 4, 92, 52),
        words("quote", 4, 59, 92, 22, { font: "script", size: 8, color: "ink", align: "center" }),
        words("caption", 4, 84, 92, 12, { font: "sans", size: 3, color: "ink", align: "center" }),
      ]),
      // One more full bleed with the caption beside it.
      page("ink", [
        frame(next(), 4, 4, 92, 70),
        words("kicker", 4, 77, 40, 5, { font: "sans", size: 2.4, color: "accent" }),
        words("caption", 4, 83, 92, 13, { font: "serif", size: 3.6 }),
      ]),
    ],
  };
}

/** Every storage key a document points at (to resolve URLs and to check ownership). */
export function keysOf(doc: MagDoc): string[] {
  const all = [doc.cover.poster, ...doc.cover.boxes.map((b) => b.src), ...doc.pages.flatMap((p) => p.boxes.map((b) => b.src))];
  return Array.from(new Set(all.filter((k): k is string => Boolean(k))));
}
