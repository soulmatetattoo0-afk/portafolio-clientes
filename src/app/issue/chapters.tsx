import Link from "next/link";

import { Ch } from "@/components/mag/Chapter";
import { Fig } from "@/components/mag/Fig";
import { Head } from "@/components/mag/Head";
import { fill, type Locale } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { BRAND } from "@/lib/brand";
import type { Story } from "@/lib/issue/types";

/**
 * The chapters of an issue that are not a piece: the cover, the word from
 * the desk, the news from the tattoo world, the artist the issue introduces,
 * the agenda and the colophon. Each is one full-screen page in container units, so it reads
 * the same in the reader on a phone and as a cover on the archive shelf.
 */

type T = Dict["issue"];
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
/** Two digits, as the issue numbers are set: 01. */
export const two = (n: number) => String(n).padStart(2, "0");

/** A word or a number set huge and faint at the foot of a page, the way a magazine fills a quiet corner. */
function Ghost({ children, right = false, tone = "bone" }: { children: React.ReactNode; right?: boolean; tone?: "ink" | "bone" }) {
  return (
    <span aria-hidden className={`p-display pointer-events-none absolute -bottom-[1.2cqh] ${right ? "-right-[2cqw]" : "-left-[1cqw]"} text-[min(40cqw,26cqh)] leading-[0.8] whitespace-nowrap ${tone === "ink" ? "text-bone opacity-[0.06]" : "text-ink opacity-[0.07]"} select-none`}>
      {children}
    </span>
  );
}

/** The front page: the wordmark across the top, the date line, the photograph, three cover lines and the lead. */
export function IssueCover({ story, no, month, t, still = false }: { story: Story; no: string; month: string; t: T; still?: boolean }) {
  return (
    <Ch tone="ink" still={still}>
      <div className="absolute inset-0 [container-type:size] @3xl:left-1/2 @3xl:w-[64cqh] @3xl:-translate-x-1/2">
        <Fig src={story.image} pos={story.pos} title={story.piece?.title ?? story.title} className="absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-black/90 via-black/50 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/95 via-black/65 to-transparent" />

        {/* The masthead */}
        <header className="absolute inset-x-[4cqw] top-[2.2cqh]">
          <p data-r className="p-stamp flex items-baseline justify-between border-b border-bone/40 pb-[0.8cqh] text-[clamp(0.5rem,2.6cqw,0.72rem)] text-bone/85">
            <span>{no}</span>
            <span>{month}</span>
          </p>
          <p data-r style={d(60)} className="p-display -ml-[0.6cqw] pt-[0.6cqh] text-center text-[min(37cqw,26cqh)] leading-[0.78] tracking-[-0.01em] text-bone">
            {BRAND.name}
          </p>
          <p data-r style={d(120)} className="flex items-baseline justify-between gap-3 border-t border-bone/40 pt-[0.8cqh]">
            <span className="p-gothic text-[clamp(1rem,5.4cqw,1.6rem)] leading-none text-accent">{story.kicker}</span>
            {story.line && <span className="p-stamp truncate text-[clamp(0.5rem,2.4cqw,0.68rem)] text-bone/70">{story.line}</span>}
          </p>
        </header>

        {/* The cover lines */}
        <div className="absolute inset-x-[4cqw] bottom-[2.6cqh]">
          <ol className="flex flex-col gap-[1.4cqh]">
            {t.cover.lines.map((l, i) => (
              <li key={l} data-r style={d(200 + i * 90)} className="flex items-baseline gap-[2.5cqw]">
                <span aria-hidden className="p-stamp shrink-0 text-[clamp(0.5rem,2.6cqw,0.72rem)] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`p-display text-bone ${i === 0 ? "text-[min(9.6cqw,6.4cqh)] text-accent" : "text-[min(6.8cqw,4.6cqh)]"}`}>{l}</span>
              </li>
            ))}
          </ol>
          <p data-r style={d(500)} className="p-quote mt-[2cqh] max-w-[30ch] border-t border-bone/30 pt-[1.4cqh] text-[min(5.2cqw,3.4cqh)] leading-[1.18] text-bone/90">
            {story.body}
          </p>
        </div>
      </div>
    </Ch>
  );
}

/** From the desk: a short letter, set large, with a drop cap and the masthead's one line underneath. */
export function Editorial({ story, folio, locale }: { story: Story; folio: string; locale: Locale }) {
  return (
    <Ch tone="bone">
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[6cqw] pt-[4cqh] @3xl:px-[10cqw]">
        <Head kicker={story.kicker} folio={folio} />
        <h2 data-r style={d(80)} className="p-display mt-[2.4cqh] text-[min(19cqw,11cqh)] text-ink">
          {story.title}
        </h2>
        <p
          data-r
          style={d(180)}
          className="p-quote mt-[3cqh] text-[min(7.2cqw,4.3cqh)] leading-[1.18] text-ink/90 first-letter:float-left first-letter:mt-[0.06em] first-letter:mr-[0.08em] first-letter:font-[family-name:var(--font-poster)] first-letter:text-[3.3em] first-letter:leading-[0.8] first-letter:font-black first-letter:text-accent first-letter:not-italic @3xl:max-w-[34ch]"
        >
          {story.body}
        </p>
        <p data-r style={d(280)} className="p-stamp mt-auto border-t-2 border-ink pt-[1.4cqh] text-[clamp(0.5rem,2.5cqw,0.68rem)] leading-[1.7] text-ink/70">
          {BRAND.editor[locale]}
        </p>
      </div>
    </Ch>
  );
}

/** A reported note: where and when, a big title, the deck in italics, the story, and the sources to read it whole. */
export function NewsNote({ story, folio, tone, t }: { story: Story; folio: string; tone: "ink" | "bone"; t: T }) {
  const sources = story.sources ?? [];
  const fg = tone === "ink" ? "text-bone" : "text-ink";
  return (
    <Ch tone={tone}>
      {story.place && <Ghost tone={tone}>{story.place.split(",")[0]}</Ghost>}
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[6cqw] pt-[4cqh] @3xl:px-[10cqw]">
        <Head kicker={story.kicker} folio={folio} compact />
        <p data-r style={d(40)} className={`p-stamp mt-[2cqh] flex flex-wrap items-baseline gap-x-3 border-y py-[0.8cqh] text-[clamp(0.55rem,2.6cqw,0.72rem)] ${tone === "ink" ? "border-bone/30 text-bone/80" : "border-ink/25 text-ink/75"}`}>
          {story.place && <span>{story.place}</span>}
          {story.date && <span className="text-accent">{story.date}</span>}
        </p>
        <h2 data-r style={d(80)} className={`p-display mt-[2cqh] text-[min(12.5cqw,7.6cqh)] leading-[0.9] ${fg} @3xl:max-w-[16ch]`}>
          {story.title}
        </h2>
        <span aria-hidden data-r style={d(140)} className="mt-[1.8cqh] block h-[3px] w-[18cqw] shrink-0 bg-accent" />
        {story.deck && (
          <p data-r style={d(180)} className={`p-quote mt-[1.8cqh] text-[min(5.6cqw,3.3cqh)] leading-[1.18] ${tone === "ink" ? "text-bone/90" : "text-ink/90"} @3xl:max-w-[40ch]`}>
            {story.deck}
          </p>
        )}
        <p data-r style={d(240)} className={`mt-[1.8cqh] min-h-0 overflow-hidden text-[min(3.9cqw,2.25cqh)] leading-[1.5] ${tone === "ink" ? "text-bone/80" : "text-ink/80"} @3xl:max-w-[60ch]`}>
          {story.body}
        </p>
        {sources.length > 0 && (
          <p data-r style={d(300)} className={`p-stamp mt-auto flex flex-wrap items-center gap-x-3 border-t pt-[1cqh] text-[clamp(0.52rem,2.5cqw,0.68rem)] ${tone === "ink" ? "border-bone/30 text-bone/70" : "border-ink/25 text-ink/70"}`}>
            <span>{sources.length > 1 ? t.reader.sources : t.reader.source}</span>
            {sources.map((src) => (
              <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-1 underline underline-offset-4 ${tone === "ink" ? "decoration-bone/40 text-bone" : "decoration-ink/40 text-ink"}`}>
                {src.name}
                <span aria-hidden className="text-accent">↗</span>
              </a>
            ))}
          </p>
        )}
      </div>
    </Ch>
  );
}

/** House news about an artist on VANTA: their photograph across the top, who they are, and the two doors into their page. */
export function Feature({ story, folio, t }: { story: Story; folio: string; t: T }) {
  const artist = story.artist;
  return (
    <Ch tone="ink" accent={story.accent}>
      <div className="absolute inset-0 flex flex-col @3xl:flex-row">
        <Fig src={story.image} pos={story.pos} title={story.title} caption={story.line} className="h-[46%] w-full shrink-0 @3xl:h-full @3xl:w-1/2" />
        <div className="flex min-h-0 flex-1 flex-col p-[6cqw] pt-[2.4cqh] @3xl:p-[4cqw]">
          <Head kicker={story.kicker} folio={folio} compact />
          {story.place && (
            <p data-r style={d(40)} className="p-stamp mt-[1.4cqh] text-[clamp(0.55rem,2.6cqw,0.72rem)] text-bone/70">
              {story.place}
            </p>
          )}
          <h2 data-r style={d(80)} className="p-display mt-[0.8cqh] text-[min(13cqw,7cqh)] leading-[0.88] text-accent">
            {story.title}
          </h2>
          {story.deck && (
            <p data-r style={d(160)} className="p-quote mt-[1.4cqh] text-[min(5.2cqw,3cqh)] leading-[1.18] text-bone/90">
              {story.deck}
            </p>
          )}
          <p data-r style={d(220)} className="mt-[1.4cqh] min-h-0 overflow-hidden text-[min(3.8cqw,2.2cqh)] leading-[1.5] text-bone/80 @3xl:max-w-[52ch]">
            {story.body}
          </p>
          {artist && (
            <div data-r style={d(300)} className="mt-auto flex flex-wrap gap-2 pt-[1.6cqh]">
              <Link href={`/${artist.slug}#bio`} className="btn bg-accent text-ink hover:opacity-90">
                {t.feature.read}
              </Link>
              {artist.accepting && (
                <Link href={`/${artist.slug}/request`} className="btn border border-bone/60 text-bone hover:bg-bone/10">
                  {t.feature.request}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </Ch>
  );
}

/** What is coming: dates set large down the left, the event and the place beside them. */
export function Agenda({ story, folio }: { story: Story; folio: string }) {
  const events = story.events ?? [];
  return (
    <Ch tone="bone">
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[5cqw] pt-[4cqh]">
        <Head kicker={story.kicker} folio={folio} compact />
        <h2 data-r style={d(80)} className="p-display mt-[1.6cqh] text-[min(15cqw,9cqh)] text-ink">
          {story.title}
        </h2>
        <p data-r style={d(160)} className="p-quote mt-[1.2cqh] max-w-[36ch] text-[min(5cqw,3cqh)] leading-[1.18] text-ink/80">
          {story.body}
        </p>
        <ol data-r style={d(240)} className="mt-[2cqh] min-h-0 overflow-hidden border-t-2 border-ink">
          {events.map((e) => (
            <li key={e.name} className="grid grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)] items-baseline gap-[3cqw] border-b border-ink/20 py-[1.2cqh]">
              <span className="p-display text-[min(6.4cqw,3.8cqh)] leading-none text-accent tabular-nums">{e.date}</span>
              <span className="min-w-0">
                <span className="p-display block text-[min(5.4cqw,3.2cqh)] leading-[0.95] text-ink">{e.name}</span>
                <span className="p-stamp mt-[0.5cqh] block text-[clamp(0.5rem,2.4cqw,0.66rem)] text-ink/60">{e.place}</span>
              </span>
            </li>
          ))}
        </ol>
        {story.line && <p data-r style={d(320)} className="p-stamp mt-auto pt-[1.2cqh] text-[clamp(0.5rem,2.3cqw,0.64rem)] text-ink/55">{story.line}</p>}
      </div>
    </Ch>
  );
}

/** The colophon, on the house colour: thanks, who made it, the two things to do next, and when the next one comes. */
export function Colophon({ story, no, number, month, locale, t, contributors, share }: { story: Story; no: string; number: number; month: string; locale: Locale; t: T; contributors: { name: string; url: string }[]; share: { onShare: () => void; copied: boolean } }) {
  return (
    <Ch tone="accent">
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[6cqw] pt-[4cqh]">
        <p data-r className="p-gothic flex items-baseline justify-between gap-3 text-[clamp(1rem,5cqw,1.5rem)] text-ink/75">
          <span>{story.kicker}</span>
          <span className="p-stamp text-[clamp(0.5rem,2.4cqw,0.68rem)]">
            {BRAND.name} · {no}
          </span>
        </p>
        <h2 data-r style={d(80)} className="p-display mt-[2cqh] text-[min(14.5cqw,9cqh)] text-ink">
          {story.title}
        </h2>
        <p data-r style={d(160)} className="p-quote mt-[2.4cqh] text-[min(5.8cqw,3.5cqh)] leading-[1.2] text-ink/90 @3xl:max-w-[36ch]">
          {story.body}
        </p>
        <p data-r style={d(220)} className="p-stamp mt-[2.4cqh] text-[clamp(0.52rem,2.5cqw,0.68rem)] leading-[1.7] text-ink/75">
          {story.line ?? BRAND.editor[locale]}
          <br />
          {BRAND.name} {no} · {month}
        </p>
        {contributors.length > 0 && (
          <div data-r style={d(260)} className="mt-[2.4cqh] border-t border-ink/30 pt-[1.4cqh]">
            <p className="p-stamp text-[clamp(0.52rem,2.5cqw,0.68rem)] text-ink/70">{t.colophon.contributors}</p>
            <p className="p-display mt-[0.8cqh] text-[min(4.6cqw,2.7cqh)] leading-[1.15] text-ink">
              {contributors.map((c, i) => (
                <span key={c.url}>
                  <span className="whitespace-nowrap">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {c.name}
                    </a>
                    {i < contributors.length - 1 && <span className="text-ink/45"> /</span>}
                  </span>{" "}
                </span>
              ))}
            </p>
          </div>
        )}
        <div data-r style={d(300)} className="mt-auto flex flex-col gap-[1.4cqh]">
          <div className="flex flex-wrap gap-2">
            <Link href={story.href ?? "/artists"} className="btn btn-sm bg-ink text-bone hover:bg-ink/85">
              {t.colophon.send}
            </Link>
            <button type="button" onClick={share.onShare} className="btn btn-sm border border-ink/70 text-ink hover:bg-ink/10" aria-live="polite">
              {share.copied ? t.reader.copied : t.colophon.share}
            </button>
          </div>
          <p className="flex items-center justify-between gap-3 border-t border-ink/30 pt-[1.2cqh]">
            <span className="p-display text-[min(6.4cqw,4cqh)] text-ink">{fill(t.colophon.next, { n: two(number + 1) })}</span>
            <Link href="/issues" className="p-stamp inline-flex min-h-11 shrink-0 items-center text-[clamp(0.52rem,2.5cqw,0.68rem)] text-ink underline decoration-ink/40 underline-offset-4">
              {t.reader.archive}
            </Link>
          </p>
        </div>
      </div>
    </Ch>
  );
}
