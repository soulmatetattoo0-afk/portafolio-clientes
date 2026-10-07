"use client";

import { useEffect, useState } from "react";

import { fill } from "@/i18n";

import type { ExperienceData } from "./types";
import { coverWordOf } from "./types";

/**
 * The opening screen: the artist's photo over a giant word, name, headline and
 * one tap to continue. Everything animates in once; the whole surface is the button.
 */
export function Cover({ data, onEnter }: { data: ExperienceData; onEnter: () => void }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const word = coverWordOf(artist, artist.styles[0] ? styleWord(artist.styles[0], locale) : "");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 420);
  };

  if (artist.cover_poster && artist.portrait_url) {
    // The artist's own poster: shown whole on ink, one pulse to enter.
    return (
      <button
        type="button"
        onClick={enter}
        aria-label={a.cover.enter}
        className={`relative mx-auto block h-dvh w-full max-w-[720px] cursor-pointer overflow-hidden bg-ink text-left transition-[opacity,transform] duration-500 ease-[var(--ease-out-quart)] ${leaving ? "scale-[1.04] opacity-0" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artist.portrait_url} alt={artist.display_name} className="p-rise absolute inset-x-0 top-0 h-[calc(100%-4.5rem)] w-full object-contain object-top" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        <div className="p-grain" aria-hidden />
        <p className="p-stamp p-rise p-pulse absolute right-5 bottom-[max(env(safe-area-inset-bottom),1.5rem)] left-5 flex items-center justify-center gap-3 text-bone" style={{ animationDelay: "900ms" }}>
          <span aria-hidden className="inline-block h-[2px] w-8 bg-accent" />
          {a.cover.enter}
          <span aria-hidden className="inline-block h-[2px] w-8 bg-accent" />
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enter}
      aria-label={a.cover.enter}
      className={`relative mx-auto block h-dvh w-full max-w-[720px] cursor-pointer overflow-hidden text-left transition-[opacity,transform] duration-500 ease-[var(--ease-out-quart)] ${leaving ? "scale-[1.04] opacity-0" : ""}`}
    >
      {artist.portrait_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artist.portrait_url} alt="" className="p-photo absolute inset-0 h-full w-full object-cover object-top" style={{ animationDelay: "60ms", maskImage: "linear-gradient(to bottom, black 55%, transparent 96%)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 96%)" }} />
      ) : (
        <div aria-hidden className="absolute inset-0 [background:radial-gradient(ellipse_60%_45%_at_50%_42%,rgb(255_255_255/0.06),transparent_70%)]" />
      )}
      {/* The word sits over the photo in difference blend: bone on the dark ground, dark across the figure, as if the body stood in front of it. */}
      <div aria-hidden className="absolute inset-x-0 top-[40%] grid place-items-center overflow-hidden mix-blend-difference md:top-[30%]">
        <span className="p-display p-word block w-full text-center text-bone" style={{ animationDelay: "120ms", fontSize: `min(34vw, ${Math.min(34, 96 / (0.5 * Math.max(3, word.length))).toFixed(1)}vw, 22rem)` }}>
          {word}
        </span>
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/55 via-transparent to-ink" />
      <div className="p-grain" aria-hidden />

      {/* Top: name and headline, like the credit block on a poster. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <span className="p-stamp p-rise text-bone/80" style={{ animationDelay: "500ms" }}>
          {artist.home_city ? artist.home_city.toUpperCase() : ""}
        </span>
        <span className="p-stamp p-rise text-right text-bone/80" style={{ animationDelay: "560ms" }}>
          {artist.since_year ? fill(a.cover.since, { year: artist.since_year }).toUpperCase() : ""}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <h1 className="p-display p-rise text-[clamp(2.6rem,11vw,5.5rem)] text-bone" style={{ animationDelay: "650ms" }}>
          {artist.display_name}
        </h1>
        {artist.headline && (
          <p className="p-rise mt-3 max-w-[30ch] text-[0.95rem] text-bone/85" style={{ animationDelay: "780ms" }}>
            {artist.headline}
          </p>
        )}
        {artist.cover_quote && (
          <p className="p-quote p-rise mt-5 max-w-[28ch] text-[1.25rem] text-accent" style={{ animationDelay: "900ms" }}>
            “{artist.cover_quote}”
          </p>
        )}
        <p className="p-stamp p-rise p-pulse mt-8 flex items-center gap-3 text-bone" style={{ animationDelay: "1300ms" }}>
          <span aria-hidden className="inline-block h-[2px] w-8 bg-accent" />
          {a.cover.enter}
        </p>
      </div>
    </button>
  );
}

function styleWord(slug: string, locale: "en" | "es") {
  const words: Record<string, [string, string]> = {
    realism: ["REALISM", "REALISMO"],
    surrealism: ["SURREAL", "SURREAL"],
    fine_line: ["FINE LINE", "FINE LINE"],
    blackwork: ["BLACKWORK", "BLACKWORK"],
    neo_traditional: ["NEO TRAD", "NEO TRAD"],
    traditional: ["TRADITIONAL", "TRADICIONAL"],
    japanese: ["IREZUMI", "IREZUMI"],
    illustrative: ["INK", "TINTA"],
    lettering: ["LETTERS", "LETRAS"],
  };
  return words[slug]?.[locale === "es" ? 1 : 0] ?? "INK";
}
