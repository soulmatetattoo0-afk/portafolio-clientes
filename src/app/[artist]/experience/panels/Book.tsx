"use client";

import Link from "next/link";
import { useState } from "react";

import { Mannequin } from "@/components/Mannequin";
import { PolicyList } from "@/components/Policy";
import { fill } from "@/i18n";
import { money } from "@/lib/format";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { PanelHead } from "../Panel";
import type { ExperienceData, PanelId } from "../types";

/** How a request works, with the real figure to try, and the one button that starts it. */
export function Book({ data, onGo }: { data: ExperienceData; onGo: (id: PanelId) => void }) {
  const { artist, t, locale } = data;
  const a = t.artist;
  const p = a.panel.book;
  const [zone, setZone] = useState<string | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const label = zone ? PLACEMENT_BY_SLUG.get(zone)?.label[locale] : null;
  return (
    <div className="pb-28">
      <PanelHead id="book" kicker={a.deck.cards.book.kicker} title={a.deck.cards.book.title} lead={artist.accepting ? p.lead : p.closed} />

      {!artist.accepting && (
        <button type="button" className="btn btn-secondary mx-5" onClick={() => onGo("spots")}>
          {p.toSpots}
        </button>
      )}

      <ol className="mx-5 mt-2 grid gap-5 border-t-2 border-bone pt-6">
        {a.how.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-3">
            <span className="p-display text-[3rem] leading-[0.8] text-accent">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="p-display text-[1.45rem]">{step.title}</p>
              <p className="mt-1 text-[0.92rem] text-bone/80">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {!noWebgl && (
        <figure className="mx-5 mt-10">
          <div className="relative h-[52dvh] min-h-[320px] overflow-hidden rounded-[18px] border border-line [background:radial-gradient(ellipse_60%_50%_at_50%_28%,#3d3e43,transparent_72%),radial-gradient(ellipse_70%_22%_at_50%_100%,rgb(0_0_0/0.65),transparent_70%),#1c1d20]">
            <Mannequin className="absolute inset-0" body="f" heightCm={167} mode="zone" placement={zone} onZoneTap={setZone} onUnsupported={() => setNoWebgl(true)} label={p.figure} />
            <p aria-live="polite" className="p-quote pointer-events-none absolute inset-x-0 bottom-4 text-center text-[1.4rem] text-bone">
              {label}
            </p>
          </div>
          <figcaption className="p-stamp mt-3 text-bone-dim">{p.figure}</figcaption>
        </figure>
      )}

      <div className="mx-5 mt-10 grid gap-2 border-t border-line pt-6">
        <p className="p-stamp text-bone-dim">{a.policyTitle}</p>
        <div className="text-[0.92rem] text-bone/85">
          <PolicyList policy={artist.deposit_policy} t={t} />
        </div>
        {artist.min_price_cents ? <p className="mt-2 text-[0.92rem] text-bone/85">{fill(a.startingAt, { price: money(artist.min_price_cents, artist.currency, locale) })}</p> : null}
      </div>

      {artist.accepting && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/90 to-transparent px-5 pt-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <Link href={`/${artist.slug}/request`} className="btn btn-accent mx-auto flex w-full max-w-3xl">
            {p.start}
          </Link>
        </div>
      )}
    </div>
  );
}
