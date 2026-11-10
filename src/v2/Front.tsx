import { LangToggle } from "@/components/LangToggle";
import { VantaMark, VantaWord } from "@/components/brand/VantaLogo";
import { ChatBubble } from "@/components/front/ChatBubble";
import { FollowButton } from "@/v2/FollowButton";
import type { Dict, Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { MyChat } from "@/lib/client";
import type { Artist } from "@/lib/queries";

import { Door, FrontGate, Reel, type Slide } from "./FrontMotion";

/**
 * The artist's page, one phone screen: VANTA on a rule, the name set as wide
 * as the phone, and four doors. 01 Obras plays their work as a reel, 02 Revista
 * is the magazine itself, 03 Fechas a calendar leaf with the next open day,
 * 04 Reservar the key in their colour. The artist sees exactly this; the edit
 * buttons wait inside each door. What moves lives in FrontMotion.
 */

/** Advance widths of the display face, in em: enough to set a name to the width of the phone before it paints. */
const WIDTHS: Record<string, number> = {
  A: 0.483, B: 0.478, C: 0.495, D: 0.5, E: 0.413, F: 0.411, G: 0.498, H: 0.49, I: 0.235, J: 0.458, K: 0.502, L: 0.407, M: 0.75,
  N: 0.548, O: 0.502, P: 0.476, Q: 0.502, R: 0.482, S: 0.479, T: 0.433, U: 0.492, V: 0.499, W: 0.805, X: 0.476, Y: 0.47, Z: 0.423,
  "1": 0.279, " ": 0.225, ".": 0.255, "&": 0.624, "-": 0.451, "'": 0.208,
};
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const measure = (s: string) => [...plain(s)].reduce((w, c) => w + (WIDTHS[c] ?? 0.5) + 0.005, 0);

/** One line while it reads large; a long name breaks at the space that leaves both lines closest in width. */
function setName(name: string): { lines: string[]; em: number } {
  const words = name.trim().split(/\s+/);
  const whole = words.join(" ");
  if (words.length < 2 || measure(whole) <= 10.5) return { lines: [whole], em: measure(whole) };
  let best = { lines: [whole], em: measure(whole) };
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const em = Math.max(...lines.map(measure));
    if (em < best.em) best = { lines, em };
  }
  return best;
}

export function Front({
  artist,
  reel,
  magazine,
  leaf,
  base,
  owner,
  bar,
  chats,
  following,
  t,
  locale,
}: {
  artist: Artist;
  /** The work behind the first door, in the order it plays. */
  reel: Slide[];
  /** The magazine's cover; a poster cover already carries its own masthead. */
  magazine: { url: string | null; poster: boolean };
  /** The calendar leaf: the next open day when there is one, today otherwise. */
  leaf: { band: string; day: string; foot: string };
  base: string;
  owner: boolean;
  /** Whether a tab bar sits under the page. */
  bar: boolean;
  chats: MyChat[] | null;
  following: boolean | null;
  t: Dict;
  locale: Locale;
}) {
  const f = t.v2.front;
  const accent = artist.accent ?? "#c8231e";
  const city = artist.home_city;
  const styles = artist.styles.slice(0, 2).map((s) => styleLabel(s, locale)).join(" · ");
  const name = setName(artist.display_name);
  const headline = artist.headline && artist.headline.length <= 48 ? artist.headline : null;
  const open = artist.accepting;
  let letter = 0;
  return (
    // Exactly one phone screen: a definite height is what lets the doors share it in parts.
    <div
      id="vanta-front"
      className={`poster v2-front fr-root relative flex h-dvh flex-col overflow-hidden px-3 pt-[max(env(safe-area-inset-top),0.5rem)] ${bar ? "pb-[var(--v2-bar)]" : "pb-[max(env(safe-area-inset-bottom),0.75rem)]"}`}
      style={{ ["--accent" as string]: accent }}
    >
      <FrontGate id="vanta-front" slug={artist.slug} />
      <span className="fr-glow" aria-hidden />

      {/* VANTA on a rule, the chat and the language */}
      <div className="flex items-center gap-3 px-1 pb-1.5">
        <span className="grid shrink-0 justify-items-center gap-[3px] text-bone" aria-label="VANTA">
          <VantaMark className="h-[20px] w-auto" />
          <VantaWord className="h-[5px] w-auto" />
        </span>
        <span className="h-px flex-1 bg-bone/40" aria-hidden />
        {!owner && (
          <ChatBubble chats={chats} artist={artist.display_name} requestHref={`/${artist.slug}/request?ref=chat`} signInHref={`/me/signin?mode=enter&next=${encodeURIComponent(base)}`} t={t.artist.chats} locale={locale} />
        )}
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </div>

      {/* The artist: the name is the masthead */}
      <div className="fr-name-box px-1">
        <h1
          className="p-display fr-name text-bone"
          aria-label={artist.display_name}
          style={{ fontSize: `min(${name.lines.length > 1 ? "4.2rem, 7.4svh" : "5.6rem, 12svh"}, calc(100cqi / ${(name.em * 1.035).toFixed(3)}))` }}
        >
          {name.lines.map((line) => (
            <span key={line} className="fr-line" aria-hidden>
              {line.split(" ").map((word, w) => (
                <span key={w} className="fr-word">
                  {[...word].map((ch, c) => (
                    <span key={c} className="fr-ch" style={{ ["--i" as string]: letter++ }}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          ))}
        </h1>
      </div>
      <div className="fr-meta flex min-h-[2.1rem] items-center gap-2.5 px-1 pb-2 pt-1">
        {artist.portrait_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.portrait_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-bone/25" />
        )}
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.86rem] text-bone/90">
          {city && (
            <>
              <svg className="h-[1em] w-[1em] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" />
              </svg>
              <span className="shrink-0">{city}</span>
            </>
          )}
          {city && styles && <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-bone/50" aria-hidden />}
          {styles && <span className="truncate text-accent">{styles}</span>}
        </p>
        {!owner && <FollowButton artistId={artist.id} following={following} labels={{ follow: f.follow, following: f.following }} />}
      </div>

      {/* The four doors */}
      {/* Obras takes three parts, Revista and Fechas two, Reservar one; on a short phone the key keeps its height and the others give way. */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,3fr)_minmax(0,2.1fr)_minmax(5.2rem,1.05fr)] gap-2">
        <Door href={`${base}/obras`} n="01" title={f.work} className="ed-tile fr-door fr-d1 col-span-2 text-left">
          {reel.length > 0 && <Reel slides={reel} />}
          <span className="pointer-events-none relative flex h-full flex-col p-3.5">
            <Num n={1} />
            {/* Lettering sized to the phone: it shrinks with the screen so a short one still shows the whole door. */}
            <span className="p-display mt-1.5 text-[min(4.4rem,9.5svh)] leading-[0.84] text-bone">{f.work}</span>
            {headline && <span className="mt-1.5 line-clamp-2 max-w-[24ch] text-[0.6rem] font-medium uppercase leading-[1.55] tracking-[0.3em] text-bone/90 [@media(max-height:720px)]:hidden">{headline}</span>}
            <span className="fr-go mt-auto h-[3.2rem] w-[3.2rem] [@media(max-height:620px)]:h-[2.4rem] [@media(max-height:620px)]:w-[2.4rem]">
              <Arrow />
            </span>
          </span>
        </Door>

        <Door href={`${base}/revista`} n="02" title={f.magazine} className="ed-tile fr-door fr-d2 text-left">
          <span className="fr-mag" aria-hidden>
            <span className="fr-mag-book">
              <span className="fr-mag-pages" />
              <span className="fr-mag-cover">
                {magazine.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={magazine.url} alt="" data-curtain="" draggable={false} />
                )}
                {!magazine.poster && (
                  <span className="fr-mag-head p-display" style={{ fontSize: `min(24cqi, calc(84cqi / ${measure(artist.display_name).toFixed(3)}))` }}>
                    {artist.display_name}
                  </span>
                )}
              </span>
            </span>
          </span>
          <span className="pointer-events-none relative flex h-full flex-col p-3.5">
            <Num n={2} />
            <span className="p-display mt-1.5 text-[min(2.3rem,5svh)] leading-[0.84] text-bone">{f.magazine}</span>
            <span className="fr-go mt-auto h-[2.4rem] w-[2.4rem] [@media(max-height:720px)]:hidden">
              <Arrow />
            </span>
          </span>
        </Door>

        <Door href={`${base}/fechas`} n="03" title={f.dates} className="ed-tile fr-door fr-d3 text-left">
          <span className="fr-leaf" aria-hidden>
            <span className="fr-leaf-back" />
            <span className="fr-leaf-sheet">
              <span className="fr-leaf-band">{leaf.band}</span>
              <span className="fr-leaf-day p-display">{leaf.day}</span>
              <span className="fr-leaf-foot">{leaf.foot}</span>
            </span>
          </span>
          <span className="pointer-events-none relative flex h-full flex-col p-3.5">
            <Num n={3} />
            <span className="p-display mt-1.5 text-[min(2.3rem,5svh)] leading-[0.84] text-bone">{f.dates}</span>
            <span className="sr-only">
              {leaf.band}: {leaf.day} {leaf.foot}
            </span>
            <span className="fr-go mt-auto h-[2.4rem] w-[2.4rem] [@media(max-height:720px)]:hidden">
              <Arrow />
            </span>
          </span>
        </Door>

        {/* The key: it sinks under the thumb, then the request opens. Closed, it goes dark and leads to the dates. */}
        <Door href={open ? `/${artist.slug}/request?ref=screen` : `${base}/fechas`} n="04" title={f.book} variant="key" closed={!open} className="p-key fr-key col-span-2 text-left">
          <span className="p-key-side" aria-hidden />
          <span className="p-key-cap fr-cap">
            {open && <span className="p-sheen absolute inset-0" aria-hidden />}
            <span className="relative flex w-full items-center justify-between gap-3 pl-5 pr-4">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2.5">
                  <Num n={4} />
                  <span className={`fr-dot ${open ? "p-pulse" : ""}`} aria-hidden />
                  <span className="fr-key-state truncate text-[0.6rem] font-semibold uppercase tracking-[0.28em]">{open ? f.open : f.closed}</span>
                </span>
                <span className="p-display p-key-word mt-1 text-[min(2.5rem,5.4svh)] leading-[0.82]">{f.book}</span>
              </span>
              <span className="fr-key-go inline-flex h-[2.8rem] w-[2.8rem] shrink-0 items-center justify-center rounded-full">
                <Arrow />
              </span>
            </span>
          </span>
        </Door>
      </div>
      <span className="p-grain" aria-hidden />
    </div>
  );
}

const Arrow = () => (
  <svg className="h-[45%] w-[45%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);

function Num({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-2 text-[0.62rem] font-medium tracking-[0.12em] text-bone/85">
      {String(n).padStart(2, "0")}
      <span className="h-px w-8 bg-bone/70" />
    </span>
  );
}
