"use client";

import Link from "next/link";

import { money } from "@/lib/format";

import { PanelHead } from "../Panel";
import type { ExperienceData } from "../types";
import { Plate } from "./Gallery";

/** Designs the artist has drawn and wants to tattoo: a flash sheet, one card per piece. */
export function Flash({ data }: { data: ExperienceData }) {
  const { artist, t, locale, flash } = data;
  const a = t.artist;
  const p = a.panel.flash;
  return (
    <div className="pb-16">
      <PanelHead id="flash" kicker={a.deck.cards.flash.kicker} title={a.deck.cards.flash.title} lead={p.lead} />
      {flash.length === 0 ? (
        <p className="px-5 text-bone-dim">{p.empty}</p>
      ) : (
        <ol className="grid gap-4 px-4 sm:grid-cols-2">
          {flash.map((f, i) => {
            const taken = f.status === "taken";
            const open = f.status === "available" && artist.accepting;
            return (
              <li key={f.id} className={`relative overflow-hidden rounded-[18px] border border-line bg-ink-2 ${taken ? "opacity-60" : ""}`}>
                <div className="relative aspect-[4/4.6]">
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Plate item={{ title: f.title }} index={i} />
                  )}
                  <span className={`p-stamp absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.6rem] ${f.status === "available" ? "bg-accent text-ink" : "bg-ink/85 text-bone"}`}>{p[f.status]}</span>
                  {taken && (
                    <span aria-hidden className="p-display absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-bone px-3 text-[2.4rem] text-bone opacity-80">
                      {p.taken}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 p-4">
                  <div>
                    <p className="p-display text-[1.7rem]">{f.title}</p>
                    {f.description && <p className="mt-1 text-[0.88rem] text-bone/80">{f.description}</p>}
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem]">
                    {f.size_label && (
                      <div>
                        <dt className="sr-only">{p.size}</dt>
                        <dd>{f.size_label}</dd>
                      </div>
                    )}
                    {f.price_cents != null && (
                      <div>
                        <dt className="sr-only">{p.price}</dt>
                        <dd className="t-num">{money(f.price_cents, f.currency, locale)}</dd>
                      </div>
                    )}
                    <div className="text-bone-dim">{f.repeatable ? p.repeatable : p.oneOff}</div>
                  </dl>
                  {open ? (
                    <Link href={`/${artist.slug}/request?flash=${f.id}`} className="btn btn-primary">
                      {p.want}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
