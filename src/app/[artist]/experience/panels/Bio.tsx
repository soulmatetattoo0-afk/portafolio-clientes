"use client";

import gsap from "gsap";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fill } from "@/i18n";

import { Ch } from "@/components/mag/Chapter";
import { Mag } from "@/components/mag/Mag";
import { CoverSheet, Sheet } from "@/components/magazine/Sheet";
import { ArtistCard } from "@/components/world/ArtistCard";
import { BRAND } from "@/lib/brand";

import { accentOf, type ExperienceData } from "../types";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The artist's magazine, as they laid it out in the studio: the cover under
 * our masthead, then their pages, each sheet held whole on the screen and
 * turned sideways. The sign-off on the artist's colour closes the issue.
 *
 * Opened from the deck (`from` is the cover's rectangle there), the cover
 * itself travels: a copy of it grows from the card to the cover's place in
 * the reader, then hands over to the real one and the reader can be leafed.
 */
export function Bio({ data, from = null }: { data: ExperienceData; from?: DOMRect | null }) {
  const { artist, t, locale, magazine } = data;
  const a = t.artist;
  const m = a.panel.bio.mag;
  const ph = t.magazine.ph;
  const { doc, urls } = magazine;
  const reader = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Where the cover lands: measured before the first paint, so the reader can stay hidden until the copy arrives.
  useLayoutEffect(() => {
    if (!from || reduced() || !target.current) return;
    const r = target.current.getBoundingClientRect();
    if (!r.width) return;
    gsap.set(reader.current, { opacity: 0 });
    setFlight({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, [from]);

  // The flight: from the card's rectangle to the reader's cover, then the real reader takes over.
  useLayoutEffect(() => {
    if (!flight || !from || !flyer.current) return;
    const el = flyer.current;
    const s = from.width / flight.width;
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(reader.current, { opacity: 1 });
        // the reader's bar and page count follow the cover in
        const chrome = reader.current?.querySelectorAll(".mag-root > :not(.mag-scroll)");
        if (chrome?.length) gsap.from(chrome, { opacity: 0, y: 12, duration: 0.45, ease: "power2.out" });
        setFlight(null);
      },
    });
    tl.fromTo(
      el,
      { x: from.left - flight.left, y: from.top - flight.top, scale: s, rotateX: 6, borderRadius: 6 / s, boxShadow: "0 20px 40px -18px rgb(0 0 0 / 0.9)" },
      { x: 0, y: 0, scale: 1, rotateX: 0, borderRadius: 4, boxShadow: "0 40px 80px -24px rgb(0 0 0 / 0.95)", duration: 0.95, ease: "expo.inOut" },
    ).fromTo(el.querySelector("[data-sheen]"), { xPercent: -160, opacity: 0.9 }, { xPercent: 260, opacity: 0, duration: 0.8, ease: "power2.inOut" }, 0.35);
    return () => {
      tl.kill();
    };
  }, [flight, from]);

  /** One sheet, as large as the screen allows at 2:3. */
  const hold = (node: React.ReactNode, cover = false) => (
    <Ch tone="ink">
      <div className="absolute inset-0 grid place-items-center p-[2cqmin]">
        <div ref={cover ? target : undefined} data-r={cover ? undefined : ""} className="w-[min(100%,calc((100cqh-4cqmin)*2/3))] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
          {node}
        </div>
      </div>
    </Ch>
  );

  const coverSheet = <CoverSheet cover={doc.cover} name={artist.display_name} urls={urls} ph={ph} />;
  const chapters: { key: string; label: string; node: React.ReactNode }[] = [
    { key: "cover", label: m.issue, node: hold(coverSheet, true) },
    ...doc.pages.map((page, k) => ({ key: page.id, label: `${m.page} ${k + 1}`, node: hold(<Sheet page={page} urls={urls} ph={ph} />) })),
  ];

  // Sign-off on the artist's colour.
  chapters.push({
    key: "end",
    label: m.thanks,
    node: (
      <Ch tone="accent">
        <div className="absolute inset-0 flex flex-col justify-between p-[6cqw] @3xl:p-[5cqw]">
          <p data-r className="p-gothic text-[clamp(1rem,2.2cqw,1.5rem)] text-ink/70">
            {m.issue} · {artist.display_name} × {BRAND.name}
          </p>
          <div>
            <h3 data-r style={{ "--d": "80ms" } as React.CSSProperties} className="p-display text-[clamp(4rem,24cqw,13rem)] text-ink @3xl:text-[18cqw]">
              {m.thanks}
            </h3>
            {artist.cover_quote && (
              <p data-r style={{ "--d": "180ms" } as React.CSSProperties} className="p-quote mt-[2cqw] max-w-[28ch] text-[clamp(1.2rem,3.4cqw,2rem)] text-ink/85">
                “{artist.cover_quote}”
              </p>
            )}
            {data.related.length > 0 && (
              <div data-r style={{ "--d": "300ms" } as React.CSSProperties} className="mt-[3cqw]">
                <p className="p-stamp text-ink/70">{fill(t.world.card.more, { artist: artist.display_name.split(" ")[0] })}</p>
                <ul className="-mx-[6cqw] mt-2 flex snap-x gap-2 overflow-x-auto px-[6cqw] pb-1 [scrollbar-width:none] @3xl:-mx-[5cqw] @3xl:px-[5cqw]">
                  {data.related.slice(0, 6).map((r) => (
                    <li key={r.id} className="shrink-0 snap-start">
                      <ArtistCard artist={r} locale={locale} compact />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div data-r style={{ "--d": "260ms" } as React.CSSProperties} className="flex flex-wrap items-center justify-between gap-4 border-t border-ink/25 pt-[2.5cqw]">
            <span className="p-stamp text-ink">{artist.display_name}</span>
            {artist.accepting && (
              <a href={`/${artist.slug}/request`} className="btn bg-ink text-bone hover:bg-ink/85">
                {a.cta}
              </a>
            )}
          </div>
        </div>
      </Ch>
    ),
  });

  return (
    <>
      <div ref={reader}>
        <Mag chapters={chapters} labels={{ page: m.page, next: a.panel.next, prev: a.panel.prev }} />
      </div>
      {flight &&
        createPortal(
          <div className="poster pointer-events-none fixed inset-0 z-50 bg-transparent!" style={{ ["--accent" as string]: accentOf(artist), perspective: "1400px" }} aria-hidden>
            <div ref={flyer} className="absolute overflow-hidden will-change-transform" style={{ left: flight.left, top: flight.top, width: flight.width, height: flight.height, transformOrigin: "0 0" }}>
              {coverSheet}
              <div data-sheen className="absolute inset-y-0 left-0 w-[55%]" style={{ background: "linear-gradient(105deg, transparent 20%, rgb(255 255 255 / 0.4) 50%, transparent 80%)", mixBlendMode: "screen" }} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
