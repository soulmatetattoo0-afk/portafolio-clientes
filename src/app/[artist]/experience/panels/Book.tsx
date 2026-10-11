"use client";

import Link from "next/link";

import { PanelHead } from "../Panel";
import type { ExperienceData, PanelId } from "../types";

/** How a request works, in four steps, and the one button that starts it. No fine print: the details are agreed in the chat. */
export function Book({ data, onGo }: { data: ExperienceData; onGo: (id: PanelId) => void }) {
  const { artist, t } = data;
  const a = t.artist;
  const p = a.panel.book;
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
