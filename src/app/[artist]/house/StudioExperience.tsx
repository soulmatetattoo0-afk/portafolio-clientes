"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LangToggle } from "@/components/LangToggle";
import { ChatBubble } from "@/components/front/ChatBubble";
import { Front, Label, PhotoTile, ReserveKey, labelSize, type Tile } from "@/components/front/Front";
import { fill, type Dict, type Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import { layoutOf } from "@/lib/layout";
import type { MyChat } from "@/lib/client";
import type { StudioFrontData } from "@/lib/studio-front";

import { JoinForm } from "./JoinForm";

type View = "screen" | "mag" | "pick" | "join" | "artists";
const VIEWS: View[] = ["mag", "pick", "join", "artists"];

/**
 * A studio's front: one screen of buttons (the studio's magazine, the reserve
 * key that asks which artist, the artists, their work, the door to join),
 * each opening a sheet over it. The sheet lives in the URL hash so the back
 * button closes it.
 */
export function StudioExperience({ studio, t, locale, storage, layout, className, chats = null }: { studio: StudioFrontData; t: Dict; locale: Locale; storage: { url: string; anonKey: string } | null; layout?: Tile[]; className?: string; chats?: MyChat[] | null }) {
  const h = t.house;
  const [view, setView] = useState<View>("screen");
  const accent = studio.accent ?? studio.artists[0]?.accent ?? "#d8552f";
  const tiles = layout ?? layoutOf(studio.layout, "studio");
  const allWork = studio.artists.flatMap((a) => a.pieces.map((p) => p.url));

  useEffect(() => {
    const read = () => {
      const v = window.location.hash.replace("#", "") as View;
      setView(VIEWS.includes(v) ? v : "screen");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const open = useCallback((v: View) => () => {
    history.pushState(null, "", `#${v}`);
    setView(v);
  }, []);
  const close = useCallback(() => history.back(), []);

  const render = (tile: Tile) => {
    switch (tile.kind) {
      case "mag":
        return (
          <button type="button" onClick={open("mag")} className="p-tile bg-ink text-left">
            {studio.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studio.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(10 10 10 / 0.78), rgb(10 10 10 / 0.1) 55%, transparent)" }} />
            <div className="p-halftone" />
            <div className="p-stamp absolute left-3.5 top-3.5 max-w-[70%] truncate text-[0.55rem] text-bone/85">
              {studio.name} · {h.vol}
            </div>
            <Label title={h.magazine} size={labelSize(tile)} />
          </button>
        );
      case "book":
        return <ReserveKey label={h.book} hint={h.press} onPress={open("pick")} tile={tile} />;
      case "artists":
        return <PhotoTile images={studio.artists.map((a) => a.portrait_url ?? a.pieces[0]?.url).filter((u): u is string => !!u)} title={h.artists} onClick={open("artists")} tile={tile} />;
      case "work":
        return <PhotoTile images={allWork.slice(0, 4)} title={h.work} onClick={open("mag")} tile={tile} />;
      case "join":
        return (
          <button type="button" onClick={open("join")} className="p-tile p-card !flex flex-col justify-between !rounded-[24px] !p-3.5 text-left">
            <div className="p-grain" />
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/30 text-[1.6rem] leading-none text-ink" aria-hidden>
              +
            </span>
            <Label title={h.joinTile} tone="ink" size={labelSize(tile)} flow />
          </button>
        );
      case "cal":
        return <PhotoTile images={allWork.slice(4, 5).length ? allWork.slice(4, 5) : allWork.slice(0, 1)} title={h.dates} onClick={open("pick")} tile={tile} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Front
        accent={accent}
        backdrop={studio.cover_url}
        tiles={tiles}
        render={render}
        className={className}
        nav={
          <>
            <ChatBubble
              chats={chats}
              artist={studio.name}
              requestHref={`/${studio.slug}`}
              onRequest={open("pick")}
              signInHref={`/me/signin?mode=enter&next=${encodeURIComponent(`/${studio.slug}`)}`}
              t={t.artist.chats}
              locale={locale}
            />
            <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
          </>
        }
      />
      {view !== "screen" && (
        <div className="poster fixed inset-0 z-30 flex flex-col bg-ink text-bone" style={{ ["--accent" as string]: accent }}>
          <header className="flex items-center justify-between gap-2 border-b border-line/60 px-3 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2">
            <button type="button" onClick={close} className="btn btn-ghost -ml-1 gap-2 text-bone" aria-label={h.back}>
              <span aria-hidden className="text-[1.3rem] leading-none">←</span>
            </button>
            <span className="p-stamp truncate text-bone/80">{studio.name}</span>
            <span className="w-10" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {view === "mag" && <StudioMagazine studio={studio} t={t} locale={locale} onBook={open("pick")} />}
            {view === "pick" && <Pick studio={studio} t={t} locale={locale} />}
            {view === "artists" && <Pick studio={studio} t={t} locale={locale} gallery />}
            {view === "join" && <JoinForm studio={studio} t={t} storage={storage} />}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The studio's magazine, leafed sideways: the cover, the house, then a spread
 * for each artist (the artist on the left page, their work on the right),
 * and the sign-off. On a phone each page fills the screen; wider, two pages
 * sit open side by side.
 */
function StudioMagazine({ studio, t, locale, onBook }: { studio: StudioFrontData; t: Dict; locale: Locale; onBook: () => void }) {
  const h = t.house;
  const page = "relative h-full w-screen shrink-0 snap-start overflow-hidden md:w-1/2";
  return (
    <div className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
      {/* Cover */}
      <section className={`${page} bg-ink`}>
        {studio.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={studio.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(10 10 10 / 0.85), transparent 60%)" }} />
        <div className="p-halftone" />
        <p className="p-stamp absolute left-5 top-5 text-bone/80">VANTA · {h.mag.issue}</p>
        <div className="absolute inset-x-5 bottom-8">
          <h2 className="p-display text-[clamp(3.2rem,15vw,6rem)] leading-[0.86]" style={{ color: "var(--accent)" }}>
            {studio.name}
          </h2>
          <p className="p-stamp mt-3 text-bone/75">
            {[studio.city, studio.since_year ? fill(h.mag.since, { year: String(studio.since_year) }) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>
      {/* The house */}
      <section className={`${page} bg-bone text-ink`}>
        <div className="flex h-full flex-col px-6 py-8">
          <p className="p-stamp text-ink/60">{h.mag.about}</p>
          <h3 className="p-display mt-2 text-[clamp(2.4rem,11vw,4rem)] leading-[0.9]">{studio.name}</h3>
          <p className="p-col mt-5 text-ink/85">{studio.about}</p>
          <div className="mt-auto">
            <p className="p-stamp text-ink/60">{h.mag.artists}</p>
            <ol className="mt-2 grid gap-1">
              {studio.artists.map((a, i) => (
                <li key={a.id} className="flex items-baseline gap-3 border-b border-ink/15 py-1.5">
                  <span className="p-stamp text-ink/50">{String(i + 1).padStart(2, "0")}</span>
                  <span className="p-display text-[1.4rem] leading-none">{a.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      {/* A spread per artist: the artist on the left page, the work on the right */}
      {studio.artists.map((a, i) => (
        <div key={a.id} className="contents">
          <section className={`${page} bg-ink`} style={{ ["--accent" as string]: a.accent ?? "var(--accent)" }}>
            {a.portrait_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.portrait_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(10 10 10 / 0.9), rgb(10 10 10 / 0.15) 60%)" }} />
            <p className="p-stamp absolute left-5 top-5 text-bone/80">
              {String(i + 1).padStart(2, "0")} · {h.mag.resident}
            </p>
            <div className="absolute inset-x-5 bottom-8">
              <h3 className="p-display text-[clamp(2.8rem,13vw,5rem)] leading-[0.86]" style={{ color: "var(--accent)" }}>
                {a.name}
              </h3>
              {a.headline && <p className="p-quote mt-3 text-[1.25rem] text-bone/90">{a.headline}</p>}
              <p className="p-stamp mt-3 text-bone/70">{a.styles.map((st) => styleLabel(st, locale)).join(" · ")}</p>
            </div>
          </section>
          <section className={`${page} bg-bone text-ink`}>
            <div className="flex h-full flex-col px-4 py-6">
              <p className="p-stamp px-1 text-ink/60">
                {a.name} · {h.mag.work}
              </p>
              {a.pieces.length ? (
                <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
                  {a.pieces.slice(0, 6).map((p, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.url + k} src={p.url} alt={p.title ?? ""} className={`h-full w-full rounded-[12px] object-cover ${k === 0 ? "row-span-2" : ""}`} />
                  ))}
                </div>
              ) : (
                <p className="mt-6 px-1 text-ink/60">{h.mag.empty}</p>
              )}
              {a.accepting && (
                <Link href={`/${a.slug}/request?ref=studio-mag`} className="mt-4 inline-flex h-12 items-center justify-center rounded-full px-5 text-[0.95rem] font-semibold text-bone" style={{ background: a.accent ?? "var(--accent)" }}>
                  {fill(h.mag.book, { name: a.name })}
                </Link>
              )}
            </div>
          </section>
        </div>
      ))}
      {/* Sign-off */}
      <section className={`${page} flex flex-col items-center justify-center gap-6 bg-ink px-6 text-center`}>
        <p className="p-display text-[clamp(2.6rem,12vw,4.5rem)] leading-[0.9]">{h.mag.end}</p>
        <button type="button" onClick={onBook} className="p-key h-[84px] w-full max-w-[320px]">
          <span className="p-key-side" aria-hidden />
          <span className="p-key-cap">
            <span className="p-key-word p-display text-[2rem]">{h.book}</span>
          </span>
        </button>
      </section>
    </div>
  );
}

/** Which artist: each one with their portrait and the way to book them (or see their page). */
function Pick({ studio, t, locale, gallery = false }: { studio: StudioFrontData; t: Dict; locale: Locale; gallery?: boolean }) {
  const h = t.house;
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <h2 className="p-display text-[clamp(2.2rem,10vw,3.4rem)] leading-[0.9]">{gallery ? h.artists : h.pick.title}</h2>
      {!gallery && <p className="mt-3 text-bone/80">{h.pick.lead}</p>}
      <ul className="mt-6 grid gap-3">
        {studio.artists.map((a) => (
          <li key={a.id} className="overflow-hidden rounded-[22px] border border-bone/15 bg-ink-2" style={{ ["--accent" as string]: a.accent ?? "var(--accent)" }}>
            <div className="flex gap-4 p-3">
              <span className="h-24 w-20 shrink-0 overflow-hidden rounded-[14px] bg-bone/10">
                {(a.portrait_url ?? a.pieces[0]?.url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.portrait_url ?? a.pieces[0]!.url} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="p-display truncate text-[1.7rem] leading-none">{a.name}</p>
                {a.headline && <p className="mt-1 line-clamp-2 text-[0.9rem] text-bone/75">{a.headline}</p>}
                <p className="p-stamp mt-2 truncate text-[0.55rem] text-bone/60">{a.styles.map((st) => styleLabel(st, locale)).join(" · ")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {a.accepting ? (
                <Link href={`/${a.slug}/request?ref=studio-pick`} className="inline-flex h-11 items-center justify-center rounded-full text-[0.9rem] font-semibold text-bone" style={{ background: "var(--accent)" }}>
                  {h.pick.book}
                </Link>
              ) : (
                <span className="inline-flex h-11 items-center justify-center rounded-full border border-bone/20 text-[0.85rem] text-bone/60">{h.pick.closed}</span>
              )}
              <Link href={gallery ? `/${a.slug}` : `/${a.slug}#spots`} className="inline-flex h-11 items-center justify-center rounded-full border border-bone/25 text-[0.9rem] text-bone">
                {gallery ? h.pick.page : h.pick.dates}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
