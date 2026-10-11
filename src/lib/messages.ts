import { dict, fill, type Locale } from "@/i18n";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import type { Email } from "./email";
import { env } from "./env";
import { cmLabel, dateLong, dateRange, money, moneyRange, placeLine, sessionTime } from "./format";
import { colorLabel, styleLabel } from "./catalog";

export const placementLabel = (slug: string, locale: Locale) => PLACEMENT_BY_SLUG.get(slug)?.label[locale] ?? slug;

export interface BriefSummary {
  ref: string;
  placement: string;
  full_coverage: boolean;
  size_w_cm: number | null;
  size_h_cm: number | null;
  style: string;
  color_mode: string;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  currency: string;
}

function briefRows(b: BriefSummary, locale: Locale): [string, string][] {
  const t = dict(locale).studio.brief;
  return [
    [t.placement, placementLabel(b.placement, locale)],
    [t.size, b.full_coverage ? t.fullCoverage : cmLabel(b.size_w_cm, b.size_h_cm)],
    [t.style, `${styleLabel(b.style, locale)}, ${colorLabel(b.color_mode, locale).toLowerCase()}`],
    [t.budget, moneyRange(b.budget_min_cents, b.budget_max_cents, b.currency, locale)],
  ];
}

const footer = (artist: string, locale: Locale) => fill(dict(locale).email.footer, { artist });

export function newBriefToArtist(a: { to: string; artist: string; client: string; brief: BriefSummary; briefId: string; locale: Locale }): Email {
  const t = dict(a.locale).email.newBrief;
  return {
    to: a.to,
    subject: fill(t.subject, { name: a.client, placement: placementLabel(a.brief.placement, a.locale) }),
    blocks: [
      { heading: fill(t.intro, { name: a.client }), rows: briefRows(a.brief, a.locale), cta: { label: t.cta, href: `${env.appUrl}/studio?brief=${a.briefId}` } },
    ],
    footer: footer(a.artist, a.locale),
  };
}

export function briefReceivedToClient(a: { to: string; artist: string; client: string; brief: BriefSummary; locale: Locale; chatToken?: string }): Email {
  const t = dict(a.locale).email.briefReceived;
  const chat = dict(a.locale).chat.email;
  return {
    to: a.to,
    subject: fill(t.subject, { artist: a.artist, ref: a.brief.ref }),
    blocks: [
      { paragraphs: [fill(t.intro, { name: a.client.split(" ")[0], artist: a.artist })], cta: a.chatToken ? { label: chat.open, href: `${env.appUrl}/c/${a.chatToken}` } : undefined },
      { heading: t.summary, rows: briefRows(a.brief, a.locale) },
    ],
    footer: footer(a.artist, a.locale),
  };
}

export function quoteToClient(a: {
  to: string;
  artist: string;
  artistEmail: string;
  placement: string;
  token: string;
  priceMin: number;
  priceMax: number | null;
  deposit: number;
  currency: string;
  sessions: number;
  expiresAt: Date;
  message: string;
  locale: Locale;
}): Email {
  const d = dict(a.locale);
  const t = d.email.quote;
  const q = d.quote;
  return {
    to: a.to,
    replyTo: a.artistEmail,
    subject: fill(t.subject, { artist: a.artist }),
    blocks: [
      {
        paragraphs: [fill(t.intro, { artist: a.artist, placement: placementLabel(a.placement, a.locale).toLowerCase() }), a.message].filter(Boolean),
        rows: [
          [q.price, moneyRange(a.priceMin, a.priceMax, a.currency, a.locale)],
          [d.studio.quoteForm.sessions, String(a.sessions)],
          [q.deposit, money(a.deposit, a.currency, a.locale)],
        ],
        cta: { label: t.cta, href: `${env.appUrl}/q/${a.token}` },
        note: fill(t.expires, { date: dateLong(a.expiresAt, a.locale) }),
      },
    ],
    footer: footer(a.artist, a.locale),
  };
}

export function messageToClient(a: { to: string; artist: string; artistEmail: string; subject: string; message: string; locale: Locale; hint?: string }): Email {
  return {
    to: a.to,
    replyTo: a.artistEmail,
    subject: a.subject,
    blocks: [{ paragraphs: [a.message], note: a.hint }],
    footer: footer(a.artist, a.locale),
  };
}

export interface BookingInfo {
  artist: string;
  client: string;
  startsAt: Date;
  timezone: string;
  city: string | null;
  studioName: string | null;
  address: string | null;
  deposit: number;
  currency: string;
  token: string;
}

function whenWhere(b: BookingInfo, locale: Locale): [string, string][] {
  const t = dict(locale).booked;
  const { day, time } = sessionTime(b.startsAt, b.timezone, locale);
  const where = placeLine(b.studioName, b.address, b.city);
  return [[t.when, `${day}, ${time}`], ...(where ? ([[t.where, where]] as [string, string][]) : []), [t.deposit, money(b.deposit, b.currency, locale)]];
}

export function bookedToClient(to: string, b: BookingInfo, locale: Locale): Email {
  const t = dict(locale).email.booked;
  const date = dateLong(b.startsAt, locale, b.timezone);
  return {
    to,
    subject: fill(t.subject, { date, artist: b.artist }),
    blocks: [
      { heading: dict(locale).booked.title, paragraphs: [t.intro], rows: whenWhere(b, locale), cta: { label: t.cta, href: `${env.appUrl}/q/${b.token}` } },
      { heading: dict(locale).booked.prepTitle, paragraphs: dict(locale).booked.prep.map((p) => `· ${p}`) },
    ],
    footer: footer(b.artist, locale),
  };
}

export function bookedToArtist(to: string, b: BookingInfo, briefId: string, locale: Locale): Email {
  const t = dict(locale).email.artistBooked;
  const date = dateLong(b.startsAt, locale, b.timezone);
  return {
    to,
    subject: fill(t.subject, { name: b.client, date }),
    blocks: [{ paragraphs: [fill(t.intro, { name: b.client, amount: money(b.deposit, b.currency, locale) })], rows: whenWhere(b, locale), cta: { label: dict(locale).email.newBrief.cta, href: `${env.appUrl}/studio?brief=${briefId}` } }],
    footer: footer(b.artist, locale),
  };
}

export function reminderToClient(to: string, b: BookingInfo, days: 3 | 1, locale: Locale): Email {
  const t = dict(locale).email.reminder;
  return {
    to,
    subject: days === 3 ? t.subject3 : t.subject1,
    blocks: [
      { paragraphs: [fill(t.intro, { artist: b.artist })], rows: whenWhere(b, locale) },
      { heading: dict(locale).booked.prepTitle, paragraphs: dict(locale).booked.prep.map((p) => `· ${p}`) },
    ],
    footer: footer(b.artist, locale),
  };
}

export function waitlistOpen(to: string, a: { artist: string; slug: string; city: string; locale: Locale }): Email {
  const t = dict(a.locale).email.waitlist;
  return {
    to,
    subject: fill(t.subject, { artist: a.artist, city: a.city }),
    blocks: [{ paragraphs: [fill(t.intro, { artist: a.artist, city: a.city })], cta: { label: fill(t.cta, { artist: a.artist }), href: `${env.appUrl}/${a.slug}/request` } }],
    footer: footer(a.artist, a.locale),
  };
}

/* ------------------------------------------------------------ follower alerts */

export interface FollowerArtist {
  artist: string;
  slug: string;
  locale: Locale;
}

export function spotToFollower(to: string, a: FollowerArtist & { city: string; startsOn: string | null; endsOn: string | null }): Email {
  const t = dict(a.locale).email.spot;
  const dates = dateRange(a.startsOn, a.endsOn, a.locale);
  return {
    to,
    subject: fill(t.subject, { artist: a.artist, city: a.city }),
    blocks: [
      {
        paragraphs: [fill(t.intro, { artist: a.artist, city: a.city })],
        rows: dates ? [[t.dates, dates]] : undefined,
        cta: { label: t.cta, href: `${env.appUrl}/${a.slug}#spots` },
        note: fill(t.why, { artist: a.artist, city: a.city }),
      },
    ],
    footer: footer(a.artist, a.locale),
  };
}

export function booksOpenToFollower(to: string, a: FollowerArtist): Email {
  const t = dict(a.locale).email.booksOpen;
  return {
    to,
    subject: fill(t.subject, { artist: a.artist }),
    blocks: [{ paragraphs: [fill(t.intro, { artist: a.artist })], cta: { label: t.cta, href: `${env.appUrl}/${a.slug}/request` } }],
    footer: footer(a.artist, a.locale),
  };
}

export function newWorkToFollower(to: string, a: FollowerArtist): Email {
  const t = dict(a.locale).email.newWork;
  return {
    to,
    subject: fill(t.subject, { artist: a.artist }),
    blocks: [{ paragraphs: [fill(t.intro, { artist: a.artist })], cta: { label: t.cta, href: `${env.appUrl}/${a.slug}#work` } }],
    footer: footer(a.artist, a.locale),
  };
}

/* ------------------------------------------------------------------ chat */

/** A new message from the client, for the artist: the words and the way back to the conversation. */
export function chatToArtist(a: { to: string; client: string; artist: string; message: string; briefId: string; locale: Locale }): Email {
  const t = dict(a.locale).chat.email;
  return {
    to: a.to,
    subject: fill(t.toArtistSubject, { name: a.client }),
    blocks: [{ paragraphs: [a.message], cta: { label: t.open, href: `${env.appUrl}/studio?brief=${a.briefId}` } }],
    footer: footer(a.artist, a.locale),
  };
}

/** A new message or offer from the artist, for the client: the link into their conversation. */
export function chatToClient(a: { to: string; artist: string; message: string; chatToken: string; locale: Locale; offer?: boolean }): Email {
  const t = dict(a.locale).chat.email;
  return {
    to: a.to,
    subject: fill(a.offer ? t.offerSubject : t.toClientSubject, { artist: a.artist }),
    blocks: [{ paragraphs: [a.message].filter(Boolean), cta: { label: t.open, href: `${env.appUrl}/c/${a.chatToken}` } }],
    footer: footer(a.artist, a.locale),
  };
}
