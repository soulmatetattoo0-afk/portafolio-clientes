import { getDb } from "./db";
import { DocSchema, keysOf, starterDoc, type MagDoc } from "./magazine";
import { fileUrl } from "./storage";

export interface Magazine {
  doc: MagDoc;
  /** Storage key → URL the browser can load. */
  urls: Record<string, string>;
}

export async function resolveUrls(doc: MagDoc): Promise<Record<string, string>> {
  const keys = keysOf(doc);
  const urls = await Promise.all(keys.map((k) => fileUrl("public", k)));
  return Object.fromEntries(keys.map((k, i) => [k, urls[i]]));
}

/**
 * The artist's magazine as saved, or the starter layout built from their
 * published portfolio when they have not touched it yet.
 */
export async function getMagazine(artistId: string): Promise<Magazine> {
  const db = await getDb();
  const row = await db.one<{ magazine: unknown; portrait_path: string | null }>(`select magazine, portrait_path from artists where id = $1`, [artistId]);
  const parsed = row?.magazine ? DocSchema.safeParse(typeof row.magazine === "string" ? JSON.parse(row.magazine) : row.magazine) : null;
  let doc: MagDoc;
  if (parsed?.success) doc = parsed.data;
  else {
    const photos = await db.query<{ image_path: string }>(
      `select image_path from portfolio_items where artist_id = $1 and published and image_path is not null order by featured desc, sort`,
      [artistId],
    );
    const portrait = row?.portrait_path ?? null;
    doc = starterDoc(photos.map((p) => p.image_path), portrait, portrait);
  }
  return { doc, urls: await resolveUrls(doc) };
}
