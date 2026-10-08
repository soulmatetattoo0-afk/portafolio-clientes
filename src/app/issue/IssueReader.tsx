"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Fact } from "@/components/mag/Fact";
import { Mag, type MagChapter } from "@/components/mag/Mag";
import { after, type Tone } from "@/components/mag/rules";
import { Bleed, Quote, Split } from "@/components/mag/spreads";
import { fill, type Locale } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { BRAND } from "@/lib/brand";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import type { Story } from "@/lib/issue/types";
import { PLACEMENT_BY_SLUG, ZONE_BY_SLUG } from "@/mannequin/catalog";

import { CityDispatch, Colophon, Editorial, IssueCover, NewIn, WorldNote, two } from "./chapters";

/** What the server hands the reader: the issue without its Date, already in the reader's language. */
export interface ReaderIssue {
  number: number;
  /** "No. 01" */
  no: string;
  /** "October 2026" */
  month: string;
  title: string;
  stories: Story[];
}

/** Relative luminance of a hex colour, 0 (black) to 1 (white). */
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.2;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** An artist's accent, lifted on ink or deepened on bone when it would vanish into the paper. */
function readable(accent: string, tone: Tone) {
  const l = luminance(accent);
  if (tone === "ink" && l < 0.1) return `color-mix(in oklab, ${accent} 45%, #e9e2d4)`;
  if (tone === "bone" && l > 0.42) return `color-mix(in oklab, ${accent} 70%, #0a0a0a)`;
  return accent;
}

/**
 * The issue reader: every story of the issue as a chapter of the same
 * sideways magazine the artists have. Pieces reuse the artist magazine's
 * spreads in their artist's colour; the rest wear the house's. The address
 * follows the page (`?p=`), so any page can be shared.
 */
export function IssueReader({ issue, locale, t, appUrl, initialKey }: { issue: ReaderIssue; locale: Locale; t: Dict["issue"]; appUrl: string; initialKey?: string }) {
  const r = t.reader;
  const base = `/issue/${issue.number}`;
  const [key, setKey] = useState(() => (initialKey && issue.stories.some((s) => s.id === initialKey) ? initialKey : (issue.stories[0]?.id ?? "")));
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onChange = useCallback(
    (k: string) => {
      setKey(k);
      window.history.replaceState(window.history.state, "", k === "cover" ? base : `${base}?p=${encodeURIComponent(k)}`);
    },
    [base],
  );

  const onShare = useCallback(async () => {
    const url = `${appUrl}${base}${key && key !== "cover" ? `?p=${encodeURIComponent(key)}` : ""}`;
    const title = `${BRAND.name} ${issue.no} · ${issue.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(r.share, url);
    }
  }, [appUrl, base, key, issue.no, issue.title, r.share]);

  const folio = `${BRAND.name} · ${issue.no} · ${issue.month}`;
  const contributors = Array.from(new Set(issue.stories.flatMap((s) => (s.kind === "piece" && s.artist ? [s.artist.display_name] : []))));
  const styleOf = (s: string | null) => (s ? (STYLE_BY_SLUG.get(s)?.label[locale] ?? s) : null);
  const place = (s: string | null) => (s ? ((PLACEMENT_BY_SLUG.get(s) ?? ZONE_BY_SLUG.get(s))?.label[locale] ?? s) : null);

  const chapters: MagChapter[] = [];
  {
    let tone: Tone = "ink";
    let piece = 0;
    for (const s of issue.stories) {
      if (s.kind === "piece" && s.piece && s.artist) {
        piece += 1;
        const n = two(piece);
        const kind = s.template === "bleed" || s.template === "quote" || s.template === "split-r" ? s.template : "split";
        tone = after(tone, kind);
        const accent = readable(s.accent, tone);
        const p = s.piece;
        const artist = s.artist;
        const first = artist.display_name.split(" ")[0];
        const title = s.title || p.title;
        const specs = (
          <>
            {styleOf(p.style) && <Fact label={r.style}>{styleOf(p.style)}</Fact>}
            {place(p.placement) && <Fact label={r.placement}>{place(p.placement)}</Fact>}
            {artist.home_city && <Fact label={r.city}>{artist.home_city}</Fact>}
            {p.color_mode && <Fact label={r.colour}>{p.color_mode === "color" ? r.fullColour : r.blackGrey}</Fact>}
            <Fact label={r.status}>{p.is_healed ? r.healed : r.fresh}</Fact>
          </>
        );
        const foot = (
          <div data-r style={{ "--d": "360ms" } as React.CSSProperties} className={`mt-[1.2cqh] flex flex-wrap gap-x-4 gap-y-1 ${kind === "split" || kind === "split-r" ? "flex-col" : "items-center"}`}>
            <Link href={`/${artist.slug}#bio`} className="p-stamp block py-2 text-[clamp(0.52rem,2.5cqw,0.68rem)] leading-[1.6] tracking-[0.16em] text-current">
              <span className="underline decoration-current/40 underline-offset-4">{fill(r.readArtist, { artist: first })}</span>
              <span aria-hidden className="text-accent"> →</span>
            </Link>
            {artist.accepting && (
              <Link href={`/${artist.slug}/request`} className="p-stamp inline-flex min-h-10 items-center self-start border-2 border-accent px-3 text-[clamp(0.52rem,2.5cqw,0.68rem)] tracking-[0.16em] text-accent">
                {r.request}
              </Link>
            )}
          </div>
        );
        const line = [styleOf(p.style), place(p.placement), artist.home_city].filter(Boolean).join(" · ");
        chapters.push({
          key: s.id,
          label: `${n} · ${artist.display_name}`,
          node:
            kind === "bleed" ? (
              <Bleed accent={accent} piece={{ url: s.image, placement: p.placement }} n={n} kicker={artist.display_name} title={title} line={line} corner={piece % 2 === 0 ? "bl" : "tr"} foot={foot} />
            ) : kind === "quote" ? (
              <Quote tone={tone} accent={accent} piece={{ url: s.image, placement: p.placement }} n={n} kicker={artist.display_name} folio={`${BRAND.name} · ${issue.no}`} title={title} story={s.body} specs={specs} foot={foot} />
            ) : (
              <Split tone={tone} accent={accent} piece={{ url: s.image, placement: p.placement }} n={n} kicker={artist.display_name} title={title} story={s.body} specs={specs} mirror={kind === "split-r"} foot={foot} />
            ),
        });
        continue;
      }
      const node =
        s.kind === "cover" ? (
          <IssueCover story={s} no={issue.no} month={issue.month} t={t} />
        ) : s.kind === "editorial" ? (
          <Editorial story={s} folio={folio} locale={locale} />
        ) : s.kind === "city" ? (
          <CityDispatch story={s} folio={folio} locale={locale} t={t} />
        ) : s.kind === "world" ? (
          <WorldNote story={s} folio={folio} t={t} />
        ) : s.kind === "new_in" ? (
          <NewIn story={s} folio={folio} locale={locale} t={t} />
        ) : s.kind === "colophon" ? (
          <Colophon story={s} no={issue.no} number={issue.number} month={issue.month} locale={locale} t={t} contributors={contributors} share={{ onShare, copied }} />
        ) : null;
      if (!node) continue;
      tone = s.kind === "cover" || s.kind === "world" ? "ink" : "bone";
      chapters.push({ key: s.id, label: s.kind === "cover" ? issue.no : s.kicker, node });
    }
  }

  const at = Math.max(0, chapters.findIndex((c) => c.key === key));
  // The chrome wears the colour of the page in view: the artist's on a piece, the house's elsewhere.
  const current = issue.stories.find((s) => s.id === key);
  const chrome = { "--accent": readable(current?.accent ?? BRAND.accent, "ink") } as React.CSSProperties;

  return (
    <div className="relative flex h-dvh flex-col" style={chrome}>
      <header className="relative z-20 flex flex-none items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <Link href="/" className="p-display flex min-h-11 items-center px-1 text-[1.45rem] leading-none text-bone" aria-label={r.home}>
          {BRAND.name}
        </Link>
        <p className="p-stamp min-w-0 truncate text-center text-[0.6rem] text-bone-dim tabular-nums" aria-live="polite">
          <span className="text-bone">{issue.no}</span>
          <span aria-hidden> · </span>
          {fill(r.chapter, { n: two(at + 1), total: two(chapters.length) })}
        </p>
        <button type="button" onClick={onShare} className="p-stamp inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.62rem] text-bone">
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" />
            <path d="M5 9.5H4v7.5h12V9.5h-1" />
          </svg>
          <span aria-live="polite">{copied ? r.copied : r.share}</span>
        </button>
      </header>
      <Mag chapters={chapters} labels={{ page: r.page, next: r.next, prev: r.prev }} initialKey={initialKey} onChange={onChange} className="min-h-0 flex-1" />
    </div>
  );
}
