import Link from "next/link";

import { Ch } from "@/components/mag/Chapter";
import { Fig } from "@/components/mag/Fig";
import { Head } from "@/components/mag/Head";
import { ArtistCard } from "@/components/world/ArtistCard";
import { SpotCard } from "@/components/world/SpotCard";
import { fill, type Locale } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { BRAND } from "@/lib/brand";
import type { Story } from "@/lib/issue/types";

/**
 * The chapters of an issue that are not a piece: the cover, the word from
 * the desk, the city dispatch, the notes from the art world, who is new and
 * the colophon. Each is one full-screen page in container units, so it reads
 * the same in the reader on a phone and as a cover on the archive shelf.
 */

type T = Dict["issue"];
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
/** Two digits, as the issue numbers are set: 01. */
export const two = (n: number) => String(n).padStart(2, "0");

/** A word or a number set huge and faint at the foot of a page, the way a magazine fills a quiet corner. */
function Ghost({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <span aria-hidden className={`p-display pointer-events-none absolute -bottom-[1.2cqh] ${right ? "-right-[2cqw]" : "-left-[1cqw]"} text-[min(40cqw,26cqh)] leading-[0.8] whitespace-nowrap text-ink opacity-[0.07] select-none`}>
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

/** The city dispatch: who is passing through, as rows you can tap, and the way to the whole city. */
export function CityDispatch({ story, folio, locale, t }: { story: Story; folio: string; locale: Locale; t: T }) {
  const city = story.city?.name ?? "";
  const spots = story.spots ?? [];
  return (
    <Ch tone="bone">
      <Ghost>{city}</Ghost>
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[5cqw] pt-[4cqh]">
        <Head kicker={story.kicker} folio={folio} />
        <h2 data-r style={d(80)} className="p-display mt-[1.6cqh] text-[min(15cqw,9cqh)] text-ink">
          {story.title}
        </h2>
        <p data-r style={d(160)} className="p-quote mt-[1.6cqh] max-w-[30ch] text-[min(5.6cqw,3.3cqh)] leading-[1.18] text-ink/85">
          {story.body}
        </p>
        {spots.length ? (
          <ul data-r style={d(240)} className="mt-[2.4cqh] flex min-h-0 flex-col gap-[1cqh] overflow-hidden @3xl:grid @3xl:grid-cols-2 @3xl:gap-3">
            {spots.slice(0, 4).map((s, i) => (
              <SpotCard key={s.stop.id} spot={s} locale={locale} lead={i === 0} />
            ))}
          </ul>
        ) : (
          <p data-r style={d(240)} className="p-quote mt-[3cqh] border-y border-ink/25 py-[2cqh] text-[min(5.6cqw,3.3cqh)] text-ink/70">
            {fill(t.city.empty, { city })}
          </p>
        )}
        {story.href && (
          <Link data-r style={d(320)} href={story.href} className="p-stamp mt-auto flex min-h-11 items-center justify-between border-t-2 border-ink pt-[1cqh] text-[clamp(0.55rem,2.7cqw,0.72rem)] text-ink">
            <span>{fill(t.city.more, { city })}</span>
            <span aria-hidden className="text-[1.2rem] leading-none text-accent">→</span>
          </Link>
        )}
      </div>
    </Ch>
  );
}

/** A note from the art world: a big title, the story in italics, the year it happened set huge behind it. */
export function WorldNote({ story, folio, t }: { story: Story; folio: string; t: T }) {
  const year = story.line?.match(/\d{4}/)?.[0];
  return (
    <Ch tone="ink">
      {year && (
        <span aria-hidden className="p-display pointer-events-none absolute -right-[3cqw] -bottom-[2cqh] text-[min(52cqw,34cqh)] leading-[0.8] text-accent opacity-[0.16] select-none">
          {year}
        </span>
      )}
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[6cqw] pt-[4cqh] @3xl:px-[10cqw]">
        <Head kicker={story.kicker} folio={folio} />
        <h2 data-r style={d(80)} className="p-display mt-[2.4cqh] text-[min(13.5cqw,8.4cqh)] text-bone @3xl:max-w-[14ch]">
          {story.title}
        </h2>
        <span aria-hidden data-r style={d(140)} className="mt-[2.4cqh] block h-[3px] w-[18cqw] bg-accent" />
        <p data-r style={d(200)} className="p-quote mt-[2.4cqh] text-[min(5.9cqw,3.6cqh)] leading-[1.22] text-bone/90 @3xl:max-w-[38ch]">
          {story.body}
        </p>
        <div data-r style={d(300)} className="mt-auto flex items-end justify-between gap-4 pt-[2cqh]">
          {story.line && <p className="p-stamp text-[clamp(0.55rem,2.6cqw,0.72rem)] text-bone/75">{story.line}</p>}
          {story.sample && <span className="p-stamp -rotate-[4deg] border border-accent px-2 py-1 text-[0.6rem] text-accent">{t.reader.sample}</span>}
        </div>
      </div>
    </Ch>
  );
}

/** Who just arrived: their covers in a grid, as on a contributors' page. */
export function NewIn({ story, folio, locale, t }: { story: Story; folio: string; locale: Locale; t: T }) {
  const artists = (story.artists ?? []).slice(0, 6);
  return (
    <Ch tone="bone">
      {artists.length > 0 && <Ghost right>{two(artists.length)}</Ghost>}
      <div className="absolute inset-0 mx-auto flex max-w-[72rem] flex-col p-[5cqw] pt-[4cqh]">
        <Head kicker={story.kicker} folio={folio} />
        <h2 data-r style={d(80)} className="p-display mt-[1.6cqh] text-[min(15cqw,9cqh)] text-ink">
          {story.title}
        </h2>
        <p data-r style={d(160)} className="p-quote mt-[1.2cqh] text-[min(5.4cqw,3.2cqh)] leading-[1.18] text-ink/80">
          {story.body}
        </p>
        <ul data-r style={d(240)} className="mt-[2.4cqh] grid min-h-0 grid-cols-3 gap-[2.4cqw] @3xl:grid-cols-6 [&_article]:w-full">
          {artists.map((a) => (
            <li key={a.id} className="min-w-0">
              <ArtistCard artist={a} locale={locale} compact />
            </li>
          ))}
        </ul>
        {story.href && (
          <Link data-r style={d(320)} href={story.href} className="p-stamp mt-auto flex min-h-11 items-center justify-between border-t-2 border-ink pt-[1cqh] text-[clamp(0.55rem,2.7cqw,0.72rem)] text-ink">
            <span>{t.newIn.more}</span>
            <span aria-hidden className="text-[1.2rem] leading-none text-accent">→</span>
          </Link>
        )}
      </div>
    </Ch>
  );
}

/** The colophon, on the house colour: thanks, who made it, the two things to do next, and when the next one comes. */
export function Colophon({ story, no, number, month, locale, t, contributors, share }: { story: Story; no: string; number: number; month: string; locale: Locale; t: T; contributors: string[]; share: { onShare: () => void; copied: boolean } }) {
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
            <p className="p-display mt-[0.8cqh] text-[min(6.2cqw,3.8cqh)] leading-[1.02] text-ink">
              {contributors.map((c, i) => (
                <span key={c}>
                  <span className="whitespace-nowrap">
                    {c}
                    {i < contributors.length - 1 && <span className="text-ink/45"> /</span>}
                  </span>{" "}
                </span>
              ))}
            </p>
          </div>
        )}
        <div data-r style={d(300)} className="mt-auto flex flex-col gap-[1.4cqh]">
          <div className="flex flex-wrap gap-2">
            <Link href={story.href ?? "/artists"} className="btn bg-ink text-bone hover:bg-ink/85">
              {t.colophon.send}
            </Link>
            <button type="button" onClick={share.onShare} className="btn border border-ink/70 text-ink hover:bg-ink/10" aria-live="polite">
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
