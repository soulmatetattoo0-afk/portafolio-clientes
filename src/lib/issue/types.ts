/**
 * What a story in the issue is. The cover is a story too, so the hero can
 * carry it. `news` is a reported note from the tattoo world with its sources,
 * `feature` is house news about an artist on VANTA, `agenda` is what is coming.
 */
export type StoryKind = "cover" | "editorial" | "news" | "feature" | "agenda" | "piece" | "colophon";

/** The spread it lays out on; the pieces reuse the artist magazine's spreads. */
export type Template = "cover" | "split" | "split-r" | "bleed" | "quote" | "list" | "text";

/** Where a reported story comes from: the outlet and the page. */
export interface Source {
  name: string;
  url: string;
}

/** One date on the agenda. */
export interface AgendaEvent {
  date: string;
  name: string;
  place: string;
}

/** The artist a story is about, enough for a byline, a link and an accent. */
export interface StoryArtist {
  id: string;
  slug: string;
  display_name: string;
  home_city: string | null;
  accent: string | null;
  accepting: boolean;
}

/** One chapter of an issue, with its words already in the reader's language. */
export interface Story {
  /** Stable within the issue; `/issue/1?p={id}` opens here. */
  id: string;
  kind: StoryKind;
  template: Template;
  /** The accent of the page: the artist's for a piece, the house's otherwise. */
  accent: string;
  /** The photograph, when there is one. Only stories with one ride on the front page. */
  image: string | null;
  /** Where to crop the photograph when it has to lose something. */
  pos: "top" | "center";
  kicker: string;
  title: string;
  body: string;
  /** One short line under the title, for the cover and the full-bleed spread. */
  line?: string;
  artist?: StoryArtist;
  piece?: { title: string; style: string | null; placement: string | null; color_mode: "black_grey" | "color" | null; is_healed: boolean };
  /** A reported story: where and when it happened, the one-line deck, and who reported it. */
  place?: string;
  date?: string;
  deck?: string;
  sources?: Source[];
  events?: AgendaEvent[];
  /** Where the story points beyond the issue. */
  href?: string;
}

export interface Issue {
  number: number;
  slug: string;
  /** The first day of the month the issue is dated. */
  month: Date;
  title: string;
  lead: string;
  accent: string;
  cover: Story;
  /** Every chapter in order, the cover first and the colophon last. */
  stories: Story[];
}
