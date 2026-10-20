import { cache } from "react";

import { dict, fill, type Locale } from "@/i18n";
import { BRAND } from "@/lib/brand";
import { getDb } from "@/lib/db";

import type { Issue, Story, StoryArtist } from "./types";

/** The issue on the newsstand. Issue tables arrive in phase two; until then No. 01 is written here. */
export const CURRENT_ISSUE = 1;

/** The artist the issue introduces, and the photographs of hers it prints (they ship in public/). */
const FEATURE_SLUG = "sova";
const COVER_IMAGE = "/demo/sova/portrait.webp";
const FEATURE_IMAGE = "/demo/sova/nueva-york.webp";

/**
 * Issue No. 01: what happened in tattooing around the world, in the reader's
 * language. Every news note is the desk's own summary of a published report,
 * and carries its sources; the cover and the feature are VANTA's own news
 * (the first artist on the platform), printed with her photographs.
 */
export const getIssue = cache(async (locale: Locale): Promise<Issue> => {
  const t = dict(locale).issue;
  const db = await getDb();
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);

  const artist = await db.one<StoryArtist>(`select id, slug, display_name, home_city, accent, accepting from artists where slug = $1 and listed`, [FEATURE_SLUG]);
  const name = artist?.display_name ?? t.feature.title;

  const cover: Story = {
    id: "cover",
    kind: "cover",
    template: "cover",
    accent: BRAND.accent,
    image: COVER_IMAGE,
    pos: "top",
    kicker: t.cover.kicker,
    title: t.title,
    body: t.lead,
    line: fill(t.cover.by, { artist: name }),
    artist: artist ?? undefined,
    href: `/issue/${CURRENT_ISSUE}`,
  };

  const editorial: Story = { id: "editorial", kind: "editorial", template: "text", accent: BRAND.accent, image: null, pos: "center", kicker: t.editorial.kicker, title: t.editorial.title, body: t.editorial.body };

  const news: Story[] = t.news.map((n) => ({
    id: n.id,
    kind: "news" as const,
    template: "text" as const,
    accent: BRAND.accent,
    image: null,
    pos: "center" as const,
    kicker: n.kicker,
    title: n.title,
    body: n.body,
    deck: n.deck,
    place: n.place,
    date: n.date,
    sources: n.sources,
  }));
  const byId = (id: string) => news.find((s) => s.id === id)!;

  const feature: Story | null = artist
    ? {
        id: `feature-${artist.slug}`,
        kind: "feature",
        template: "bleed",
        accent: artist.accent ?? BRAND.accent,
        image: FEATURE_IMAGE,
        pos: "center",
        kicker: t.feature.kicker,
        title: artist.display_name,
        body: t.feature.body,
        deck: t.feature.deck,
        place: t.feature.place,
        line: t.feature.caption,
        artist,
        href: `/${artist.slug}`,
      }
    : null;

  const agenda: Story = { id: "agenda", kind: "agenda", template: "list", accent: BRAND.accent, image: null, pos: "center", kicker: t.agenda.kicker, title: t.agenda.title, body: t.agenda.lead, line: t.agenda.source, events: t.agenda.events };

  const colophon: Story = { id: "colophon", kind: "colophon", template: "text", accent: BRAND.accent, image: null, pos: "center", kicker: t.colophon.kicker, title: t.colophon.title, body: t.colophon.thanks, line: BRAND.editor[locale], href: "/artists" };

  // The running order: the big shows first, the people, the conventions closing on New York, the artist who lives there, what is coming.
  const stories: Story[] = [
    cover,
    editorial,
    byId("tokio-irezumi"),
    byId("ink-master-17"),
    byId("liu-xiaodong-host"),
    byId("estocolmo-mediterraneo"),
    byId("minnesota-body-of-work"),
    byId("cdmx-tattooarte"),
    byId("nueva-york-verano"),
    feature,
    agenda,
    colophon,
  ].filter((s): s is Story => Boolean(s));

  return { number: CURRENT_ISSUE, slug: `no-${String(CURRENT_ISSUE).padStart(2, "0")}`, month, title: t.title, lead: t.lead, accent: BRAND.accent, cover, stories };
});

/** The stories that can carry the front page: the ones with a photograph, the cover first. */
export const heroStories = (issue: Issue): Story[] => issue.stories.filter((s) => s.image && (s.kind === "cover" || s.kind === "piece" || s.kind === "feature")).slice(0, 6);
