import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { VantaMark, VantaWord } from "@/components/brand/VantaLogo";
import { ChatBubble } from "@/components/front/ChatBubble";
import { FollowButton } from "@/v2/FollowButton";
import type { Dict, Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import type { MyChat } from "@/lib/client";
import type { Artist } from "@/lib/queries";

/**
 * The artist's page: VANTA on a rule, the artist (photo, name, city, styles)
 * and four doors in one phone screen. 01 Obras over their work, 02 Revista,
 * 03 Fechas with the month on paper, 04 Reservar as a band in their colour.
 * The artist sees exactly this; the edit buttons wait inside each door.
 */
export function Front({
  artist,
  images,
  month,
  base,
  owner,
  chats,
  following,
  t,
  locale,
}: {
  artist: Artist;
  /** The pictures behind the doors: the work, the magazine, the booking band. */
  images: { work: string | null; magazine: string | null; book: string | null };
  month: { label: string; days: { n: number; free: boolean; today: boolean }[]; offset: number };
  base: string;
  owner: boolean;
  chats: MyChat[] | null;
  following: boolean | null;
  t: Dict;
  locale: Locale;
}) {
  const f = t.v2.front;
  const accent = artist.accent ?? "#c8231e";
  const city = artist.home_city;
  return (
    // Exactly one phone screen, the bar's room taken off the bottom: a definite height is what lets the doors share it in parts.
    <div className="poster v2-front relative flex h-dvh flex-col px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[var(--v2-bar)]" style={{ ["--accent" as string]: accent }}>
      {/* VANTA on a rule, the chat and the language */}
      <div className="flex items-center gap-3 px-1 pb-2">
        <span className="grid shrink-0 justify-items-center gap-[3px] text-bone" aria-label="VANTA">
          <VantaMark className="h-[20px] w-auto" />
          <VantaWord className="h-[5px] w-auto" />
        </span>
        <span className="h-px flex-1 bg-bone/40" aria-hidden />
        {!owner && (
          <ChatBubble chats={chats} artist={artist.display_name} requestHref={`${base}/request?ref=chat`} signInHref={`/me/signin?mode=enter&next=${encodeURIComponent(base)}`} t={t.artist.chats} locale={locale} />
        )}
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </div>

      {/* The artist */}
      <div className="flex items-center gap-4 px-1 py-1.5">
        {artist.portrait_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.portrait_url} alt="" className="h-[4.9rem] w-[4.9rem] shrink-0 rounded-full object-cover ring-1 ring-bone/20" />
        ) : (
          <span className="grid h-[4.9rem] w-[4.9rem] shrink-0 place-items-center rounded-full bg-ink-2 p-display text-[2.2rem] text-accent">{artist.display_name[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`p-display uppercase leading-[0.88] text-bone [text-wrap:balance] ${artist.display_name.length > 13 ? "text-[2rem]" : "text-[2.6rem]"}`}>{artist.display_name}</h1>
          {city && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.92rem] text-bone/90">
              <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" />
              </svg>
              <span className="truncate">{city}</span>
            </p>
          )}
          {artist.styles.length > 0 && <p className="mt-0.5 truncate text-[0.92rem] text-accent">{artist.styles.slice(0, 2).map((s) => styleLabel(s, locale)).join(" · ")}</p>}
        </div>
        {!owner && <FollowButton artistId={artist.id} following={following} labels={{ follow: f.follow, following: f.following }} />}
      </div>

      {/* The four doors */}
      {/* Obras takes three parts, Revista and Fechas two, Reservar one; on a short phone Reservar keeps its height and the others give way. */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,3fr)_minmax(0,2fr)_minmax(5rem,1fr)] gap-2 pt-1 pb-2">
        <Door href={`${base}/obras`} n={1} title={f.work} caption={artist.headline && artist.headline.length <= 48 ? artist.headline : f.workSub} image={images.work} big className="col-span-2" />
        <Door href={`${base}/revista`} n={2} title={f.magazine} caption={f.magazineSub} image={images.magazine} />
        <Door href={`${base}/fechas`} n={3} title={f.dates} caption={f.datesSub} image={null} icon="calendar">
          <Sheet month={month} />
        </Door>
        <Link href={artist.accepting ? `${base}/request?ref=screen` : `${base}/fechas`} className={`ed-tile ed-book col-span-2 ${artist.accepting ? "" : "ed-book-closed"} text-left`}>
          {images.book && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images.book} alt="" aria-hidden className="ed-book-art absolute inset-y-0 right-0 h-full w-[62%] object-cover" />
          )}
          <span className="relative flex h-full items-center justify-between gap-3 px-5 py-2.5">
            <span className="flex min-w-0 flex-col justify-center">
              <span className="flex items-center gap-3">
                <Num n={4} tone={artist.accepting ? "ink" : "bone"} />
                <span className={`truncate text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${artist.accepting ? "text-ink/80" : "text-accent"}`}>{artist.accepting ? f.open : f.closed}</span>
              </span>
              <span className={`p-display mt-1 text-[min(2.3rem,5svh)] uppercase leading-[0.82] ${artist.accepting ? "text-ink" : "text-bone"}`}>{f.book}</span>
              <span className={`mt-1 truncate text-[0.6rem] font-medium uppercase tracking-[0.32em] ${artist.accepting ? "text-ink/85" : "text-bone/90"}`}>{f.bookSub}</span>
            </span>
            <span className={`inline-flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full ${artist.accepting ? "bg-ink text-bone" : "bg-accent text-bone"}`}>
              <Arrow />
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

const Arrow = () => (
  <svg className="h-[45%] w-[45%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);

function Num({ n, tone = "bone" }: { n: number; tone?: "bone" | "ink" }) {
  return (
    <span className={`flex items-center gap-2 text-[0.62rem] font-medium tracking-[0.12em] ${tone === "bone" ? "text-bone/85" : "text-ink/80"}`}>
      {String(n).padStart(2, "0")}
      <span className={`h-px w-8 ${tone === "bone" ? "bg-bone/70" : "bg-ink/70"}`} />
    </span>
  );
}

function Door({ href, n, title, caption, image, big = false, className = "", icon, children }: { href: string; n: number; title: string; caption: string; image: string | null; big?: boolean; className?: string; icon?: "calendar"; children?: React.ReactNode }) {
  return (
    <Link href={href} className={`ed-tile text-left ${className}`}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {children}
      <span
        className="absolute inset-0"
        style={{
          background: big
            ? "linear-gradient(90deg, rgb(10 10 10 / 0.82) 0%, rgb(10 10 10 / 0.45) 45%, rgb(10 10 10 / 0.05) 80%), linear-gradient(0deg, rgb(10 10 10 / 0.5), transparent 40%)"
            : "linear-gradient(180deg, rgb(10 10 10 / 0.78) 0%, rgb(10 10 10 / 0.35) 55%, rgb(10 10 10 / 0.15) 100%)",
        }}
      />
      {icon === "calendar" && (
        <span className="absolute right-4 top-4 text-bone" aria-hidden>
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
            <circle cx="9" cy="15" r="0.9" fill="currentColor" />
            <circle cx="15" cy="15" r="0.9" fill="currentColor" />
          </svg>
        </span>
      )}
      <span className="relative flex h-full flex-col p-3.5">
        <Num n={n} />
        {/* Lettering sized to the phone: it shrinks with the screen so a short one still shows the whole door. */}
        <span className={`p-display mt-1.5 uppercase leading-[0.84] text-bone ${big ? "text-[min(4.2rem,9svh)]" : "text-[min(2.3rem,5svh)]"}`}>{title}</span>
        <span className={`mt-1.5 line-clamp-2 max-w-[22ch] text-[0.6rem] font-medium uppercase leading-[1.55] tracking-[0.32em] text-bone/90 ${big ? "[@media(max-height:720px)]:hidden" : "[@media(max-height:720px)]:line-clamp-1"}`}>{caption}</span>
        {!icon && (
          <span className={`mt-auto inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-bone ${big ? "h-[3.4rem] w-[3.4rem]" : "h-[2.6rem] w-[2.6rem] [@media(max-height:720px)]:hidden"}`}>
            <Arrow />
          </span>
        )}
      </span>
    </Link>
  );
}

/** The month as a paper sheet on the table, the next free day in the accent. */
function Sheet({ month }: { month: { label: string; days: { n: number; free: boolean; today: boolean }[]; offset: number } }) {
  const next = month.days.find((d) => d.free && !d.today) ?? month.days.find((d) => d.free);
  return (
    <span
      aria-hidden
      className="absolute bottom-[-13%] right-[-16%] w-full rounded-[6px] bg-[#ece4d4] p-[4%] shadow-[0_30px_40px_-10px_rgb(0_0_0/0.8)]"
      style={{ transform: "perspective(520px) rotateX(34deg) rotateZ(-14deg)", transformOrigin: "60% 100%" }}
    >
      <span className="mb-[3%] block font-serif text-[0.7rem] italic text-[#2b2420]/70">{month.label}</span>
      <span className="grid grid-cols-7 gap-px bg-[#2b2420]/15">
        {Array.from({ length: month.offset }).map((_, i) => (
          <span key={`o${i}`} className="aspect-square bg-[#ece4d4]" />
        ))}
        {month.days.map((d) => (
          <span key={d.n} className="relative grid aspect-square place-items-center bg-[#ece4d4] text-[0.5rem] font-medium text-[#2b2420]" style={{ opacity: d.free || d.n === next?.n ? 1 : 0.35 }}>
            {d.n === next?.n ? <span className="h-[55%] w-[55%] rounded-full bg-accent" /> : d.n}
          </span>
        ))}
      </span>
    </span>
  );
}
