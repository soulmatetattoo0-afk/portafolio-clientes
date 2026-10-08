import { cache } from "react";

import { dict, fill, type Locale } from "@/i18n";
import { BRAND } from "@/lib/brand";
import { getDb } from "@/lib/db";
import { citySlug } from "@/lib/geo";
import { CARD_COLS, CARD_JOINS, CARD_SQL, type CardRow, toCard } from "@/lib/queries";
import { upcomingSpots } from "@/lib/search";
import { fileUrl } from "@/lib/storage";

import type { Issue, Story, StoryArtist, Template } from "./types";

/** The issue on the newsstand. Issue tables arrive in phase two; until then No. 01 is assembled here from what the artists published. */
export const CURRENT_ISSUE = 1;

/** The city the first issue's dispatch is from: two guests are booked there this season. */
const DISPATCH_CITY = "Miami";

const COVER_TITLE = "Saint Sebastian";

interface PieceRow {
  id: string;
  title: string | null;
  style: string | null;
  color_mode: "black_grey" | "color" | null;
  placement: string | null;
  is_healed: boolean;
  story: string | null;
  image_path: string | null;
  artist_id: string;
  slug: string;
  display_name: string;
  home_city: string | null;
  accent: string | null;
  accepting: boolean;
  created_at: unknown;
}

/** Where to crop a photograph when it has to lose something: faces and backs keep the top. */
const posOf = (placement: string | null) => (/back|chest|neck|head|face|sleeve|arm|forearm|shoulder/.test(placement ?? "") ? "top" : "center") as "top" | "center";

/** The spreads take turns: tall split, a full-bleed photograph when there is one, pull quote, mirrored split. */
const templateFor = (i: number, hasImage: boolean): Template => {
  const cycle: Template[] = ["split", "bleed", "quote", "split-r"];
  const t = cycle[i % cycle.length];
  return t === "bleed" && !hasImage ? "split" : t;
};

const artistOf = (r: PieceRow): StoryArtist => ({ id: r.artist_id, slug: r.slug, display_name: r.display_name, home_city: r.home_city, accent: r.accent, accepting: r.accepting });

/**
 * Issue No. 01, assembled from the database for one language. Only pieces
 * the artist marked featured and wrote a story for make the issue, one per
 * artist (two for the cover artist). Nothing here is invented: the pieces
 * are the artists' own, the dispatch is the real list of guest stops, and
 * the two art-world notes are documented history.
 */
export const getIssue = cache(async (locale: Locale): Promise<Issue> => {
  const t = dict(locale).issue;
  const db = await getDb();
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);

  const rows = await db.query<PieceRow>(
    `select p.id, p.title, p.style, p.color_mode, p.placement, p.is_healed, p.story, p.image_path, p.created_at,
            a.id as artist_id, a.slug, a.display_name, a.home_city, a.accent, a.accepting
       from portfolio_items p join artists a on a.id = p.artist_id
      where p.published and p.featured and p.story is not null and a.listed and a.trade = 'tattoo'
      order by (p.image_path is not null) desc, p.sort, p.created_at`,
  );
  const coverRow = rows.find((r) => r.title === COVER_TITLE && r.image_path) ?? rows.find((r) => r.image_path) ?? rows[0];
  const perArtist = new Map<string, number>();
  const picked: PieceRow[] = [];
  for (const r of rows) {
    if (coverRow && r.id === coverRow.id) continue;
    const n = perArtist.get(r.artist_id) ?? 0;
    if (n >= (coverRow && r.artist_id === coverRow.artist_id ? 2 : 1)) continue;
    perArtist.set(r.artist_id, n + 1);
    picked.push(r);
    if (picked.length >= 8) break;
  }
  const url = async (key: string | null) => (key ? await fileUrl("public", key) : null);

  const cover: Story = {
    id: "cover",
    kind: "cover",
    template: "cover",
    accent: BRAND.accent,
    image: await url(coverRow?.image_path ?? null),
    pos: posOf(coverRow?.placement ?? null),
    kicker: t.cover.kicker,
    title: t.title,
    body: t.lead,
    line: coverRow ? fill(t.cover.by, { artist: coverRow.display_name }) : undefined,
    artist: coverRow ? artistOf(coverRow) : undefined,
    piece: coverRow ? { title: coverRow.title ?? "", style: coverRow.style, placement: coverRow.placement, color_mode: coverRow.color_mode, is_healed: coverRow.is_healed } : undefined,
    href: `/issue/${CURRENT_ISSUE}`,
  };

  const pieces: Story[] = await Promise.all(
    [...(coverRow ? [coverRow] : []), ...picked].map(async (r, i) => ({
      id: `piece-${r.id.slice(0, 8)}`,
      kind: "piece" as const,
      template: templateFor(i, Boolean(r.image_path)),
      accent: r.accent ?? BRAND.accent,
      image: await url(r.image_path),
      pos: posOf(r.placement),
      kicker: r.display_name,
      title: r.title ?? "",
      body: r.story ?? "",
      line: r.home_city ?? undefined,
      artist: artistOf(r),
      piece: { title: r.title ?? "", style: r.style, placement: r.placement, color_mode: r.color_mode, is_healed: r.is_healed },
      href: `/${r.slug}#bio`,
    })),
  );

  const spots = await upcomingSpots({ city: DISPATCH_CITY, days: 75, limit: 6 });
  const dispatch: Story = {
    id: "city-" + citySlug(DISPATCH_CITY),
    kind: "city",
    template: "list",
    accent: BRAND.accent,
    image: spots[0]?.artist.portrait_url ?? null,
    pos: "top",
    kicker: t.city.kicker,
    title: fill(t.city.title, { city: DISPATCH_CITY }),
    body: fill(t.city.lead, { city: DISPATCH_CITY }),
    spots,
    city: { slug: citySlug(DISPATCH_CITY), name: DISPATCH_CITY },
    href: `/city/${citySlug(DISPATCH_CITY)}`,
  };

  const world: Story[] = t.world.map((w, i) => ({
    id: `world-${i + 1}`,
    kind: "world" as const,
    template: "text" as const,
    accent: BRAND.accent,
    image: null,
    pos: "center" as const,
    kicker: w.kicker,
    title: w.title,
    body: w.body,
    line: w.source,
  }));

  const newRows = await db.query<CardRow>(`${CARD_SQL} select ${CARD_COLS} from artists a ${CARD_JOINS} where a.listed and a.trade = 'tattoo' order by a.created_at desc limit 6`);
  const newIn: Story = {
    id: "new-in",
    kind: "new_in",
    template: "grid",
    accent: BRAND.accent,
    image: null,
    pos: "center",
    kicker: t.newIn.kicker,
    title: t.newIn.title,
    body: t.newIn.lead,
    artists: await Promise.all(newRows.map(toCard)),
    href: "/explore?sort=newest",
  };

  const editorial: Story = { id: "editorial", kind: "editorial", template: "text", accent: BRAND.accent, image: null, pos: "center", kicker: t.editorial.kicker, title: t.editorial.title, body: t.editorial.body };
  const colophon: Story = { id: "colophon", kind: "colophon", template: "text", accent: BRAND.accent, image: null, pos: "center", kicker: t.colophon.kicker, title: t.colophon.title, body: t.colophon.thanks, line: BRAND.editor[locale], href: "/artists" };

  // The running order: cover, a word from the desk, the pieces with the dispatch and the notes between them, who is new, the colophon.
  const stories: Story[] = [cover, editorial, ...pieces.slice(0, 3), dispatch, ...pieces.slice(3, 6), world[0], ...pieces.slice(6), world[1], newIn, colophon].filter(Boolean);

  return { number: CURRENT_ISSUE, slug: `no-${String(CURRENT_ISSUE).padStart(2, "0")}`, month, title: t.title, lead: t.lead, accent: BRAND.accent, cover, stories };
});

/** The stories that can carry the front page: the ones with a photograph, the cover first. */
export const heroStories = (issue: Issue): Story[] => issue.stories.filter((s) => s.image && (s.kind === "cover" || s.kind === "piece" || s.kind === "city")).slice(0, 6);
