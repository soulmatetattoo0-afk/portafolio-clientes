import { Ch } from "./Chapter";
import { Fig } from "./Fig";
import { Head } from "./Head";
import { posOf } from "./rules";

/** What a spread needs of a piece: the photograph (or none) and where to crop it. */
export interface SpreadPiece {
  url: string | null;
  placement?: string | null;
}

/** Split: the photograph takes the tall left (or right) column, the words stack beside it. */
export function Split({ tone, accent, piece, n, kicker, title, story, specs, mirror, foot }: { tone: "ink" | "bone"; accent?: string; piece: SpreadPiece; n: string; kicker: string; title: string; story: string; specs: React.ReactNode; mirror: boolean; foot?: React.ReactNode }) {
  return (
    <Ch tone={tone} accent={accent}>
      <div className={`absolute inset-0 grid grid-cols-[58%_minmax(0,1fr)] ${mirror ? "[direction:rtl]" : ""}`}>
        <Fig src={piece.url} pos={posOf(piece)} title={title} className="relative h-full w-full [direction:ltr]" />
        <div className="relative flex min-h-0 min-w-0 flex-col px-[3cqw] py-[3cqh] [direction:ltr] @3xl:px-[4cqw]">
          <span aria-hidden data-r className="p-display text-[clamp(3rem,16cqw,9rem)] leading-[0.85] text-accent">
            {n}
          </span>
          <p data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-gothic mt-[1cqh] text-[clamp(0.9rem,4.2cqw,1.5rem)] text-accent">
            {kicker}
          </p>
          <h3 data-r style={{ "--d": "140ms" } as React.CSSProperties} className="p-display mt-[1cqh] break-words text-[clamp(1.3rem,6cqw,4.5rem)] hyphens-auto @3xl:text-[5cqw]">
            {title}
          </h3>
          <p data-r style={{ "--d": "220ms" } as React.CSSProperties} className="p-quote mt-[1.6cqh] line-clamp-[9] min-h-0 text-[clamp(0.9rem,4.1cqw,1.6rem)] leading-[1.28] opacity-85 @3xl:line-clamp-[7] @3xl:max-w-[34ch] @3xl:text-[clamp(1.2rem,1.9cqw,1.8rem)]">
            {story}
          </p>
          <dl data-r style={{ "--d": "300ms" } as React.CSSProperties} className="p-stamp mt-auto grid gap-[0.7cqh] border-t border-current/25 pt-[1.6cqh] text-[clamp(0.5rem,2.5cqw,0.68rem)] tracking-[0.16em] opacity-80 @3xl:grid-cols-2 @3xl:gap-x-6 @3xl:text-[0.68rem] @3xl:tracking-[0.26em]">
            {specs}
          </dl>
          {foot}
        </div>
      </div>
    </Ch>
  );
}

/** Full bleed: the photograph is the page; a numeral, a title and one line sit in a corner, over a gradient. */
export function Bleed({ accent, piece, n, kicker, title, line, corner, foot }: { accent?: string; piece: SpreadPiece; n: string; kicker: string; title: string; line: string; corner: "bl" | "tr"; foot?: React.ReactNode }) {
  const top = corner === "tr";
  return (
    <Ch tone="ink" accent={accent}>
      <Fig src={piece.url} pos={posOf(piece)} title={title} className="absolute inset-0" />
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 h-[46%] ${top ? "top-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent" : "bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent"}`} />
      <div className={`absolute inset-x-[4cqw] flex flex-col ${top ? "top-[3cqh] items-end text-right" : "bottom-[3cqh]"}`}>
        <span aria-hidden data-r className="p-display text-[clamp(4rem,24cqw,14rem)] leading-[0.85] text-accent">
          {n}
        </span>
        <p data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-gothic mt-[0.6cqh] text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">
          {kicker}
        </p>
        <h3 data-r style={{ "--d": "140ms" } as React.CSSProperties} className="p-display mt-[0.6cqh] max-w-[12ch] text-[clamp(1.9rem,9.5cqw,6rem)] text-bone @3xl:text-[6cqw]">
          {title}
        </h3>
        {line && (
          <p data-r style={{ "--d": "220ms" } as React.CSSProperties} className="p-stamp mt-[1.2cqh] text-[clamp(0.55rem,2.6cqw,0.72rem)] text-bone/75">
            {line}
          </p>
        )}
        {foot}
      </div>
    </Ch>
  );
}

/** Pull quote: a photograph across the top, then the story set large in italics beside the numeral. */
export function Quote({ tone, accent, piece, n, kicker, folio, title, story, specs, foot }: { tone: "ink" | "bone"; accent?: string; piece: SpreadPiece; n: string; kicker: string; folio: string; title: string; story: string; specs: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <Ch tone={tone} accent={accent}>
      <div className="absolute inset-0 grid grid-rows-[49%_1fr] @3xl:grid-cols-[46%_minmax(0,1fr)] @3xl:grid-rows-1">
        <div className="relative h-full min-h-0 w-full">
          <Fig src={piece.url} pos="top" title={title} className="relative h-full w-full" />
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t ${tone === "ink" ? "from-ink" : "from-bone"} to-transparent @3xl:hidden`} />
        </div>
        <div className="relative flex min-h-0 flex-col px-[4cqw] pt-0 pb-[2.4cqh] @3xl:justify-center @3xl:px-[5cqw] @3xl:py-[4cqh]">
          <div className="flex items-end gap-[3cqw]">
            <span aria-hidden data-r className="p-display -mt-[8cqh] text-[clamp(4.5rem,24cqw,14rem)] leading-[0.8] text-accent @3xl:mt-0 @3xl:text-[12cqw]">
              {n}
            </span>
            <div className="min-w-0 pb-[0.5cqh]">
              <Head kicker={kicker} folio={folio} />
              <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display mt-[0.4cqh] text-[clamp(1.1rem,5.4cqw,3rem)] @3xl:text-[2.8cqw]">
                {title}
              </h3>
            </div>
          </div>
          <p data-r style={{ "--d": "160ms" } as React.CSSProperties} className="p-quote mt-[2cqh] line-clamp-[7] min-h-0 text-[clamp(1.4rem,7cqw,3.2rem)] opacity-90 @3xl:mt-[3cqh] @3xl:line-clamp-[6] @3xl:max-w-[22ch] @3xl:text-[clamp(1.7rem,3.4cqw,3rem)]">
            “{story}”
          </p>
          <dl data-r style={{ "--d": "260ms" } as React.CSSProperties} className="p-stamp mt-auto flex flex-wrap gap-x-[4cqw] gap-y-[0.6cqh] border-t border-current/25 pt-[1.4cqh] text-[clamp(0.5rem,2.5cqw,0.68rem)] tracking-[0.16em] opacity-80 @3xl:text-[0.68rem] @3xl:tracking-[0.26em]">
            {specs}
          </dl>
          {foot}
        </div>
      </div>
    </Ch>
  );
}
