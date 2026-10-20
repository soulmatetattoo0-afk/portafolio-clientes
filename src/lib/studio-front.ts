import { getDb } from "./db";
import { fileUrl } from "./storage";

/** A studio with several artists, as its public front reads it. */
export interface StudioFrontData {
  id: string;
  slug: string;
  name: string;
  about: string | null;
  city: string | null;
  since_year: number | null;
  accent: string | null;
  cover_url: string | null;
  layout: unknown;
  artists: {
    id: string;
    slug: string;
    name: string;
    headline: string | null;
    styles: string[];
    accepting: boolean;
    accent: string | null;
    portrait_url: string | null;
    /** Their latest published pieces, for their page in the studio's magazine. */
    pieces: { url: string; title: string | null }[];
  }[];
}

export async function getStudioFront(slug: string): Promise<StudioFrontData | null> {
  const db = await getDb();
  const s = await db.one<{ id: string; slug: string; name: string; about: string | null; city: string | null; since_year: number | null; accent: string | null; cover_path: string | null; layout: unknown }>(
    `select id, slug, name, about, city, since_year, accent, cover_path, layout from studios where slug = $1 and kind = 'studio'`,
    [slug.toLowerCase()],
  );
  if (!s) return null;
  const artists = await db.query<{ id: string; slug: string; display_name: string; headline: string | null; styles: string[]; accepting: boolean; accent: string | null; portrait_path: string | null }>(
    `select id, slug, display_name, headline, styles, accepting, accent, portrait_path from artists where studio_id = $1 and listed order by created_at`,
    [s.id],
  );
  const out: StudioFrontData["artists"] = [];
  for (const a of artists) {
    const rows = await db.query<{ image_path: string; title: string | null }>(
      `select image_path, title from portfolio_items where artist_id = $1 and published and image_path is not null order by featured desc, sort limit 6`,
      [a.id],
    );
    out.push({
      id: a.id,
      slug: a.slug,
      name: a.display_name,
      headline: a.headline,
      styles: a.styles,
      accepting: a.accepting,
      accent: a.accent,
      portrait_url: a.portrait_path ? await fileUrl("public", a.portrait_path) : null,
      pieces: await Promise.all(rows.map(async (r) => ({ url: await fileUrl("public", r.image_path), title: r.title }))),
    });
  }
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    about: s.about,
    city: s.city,
    since_year: s.since_year,
    accent: s.accent,
    cover_url: s.cover_path ? await fileUrl("public", s.cover_path) : (out[0]?.pieces[0]?.url ?? null),
    layout: s.layout,
    artists: out,
  };
}
