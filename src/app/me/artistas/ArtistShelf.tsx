"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { MyArtist } from "@/lib/client";

type Sort = "recent" | "saved" | "chats" | "az";

/**
 * The client's shelf of magazines: one cover per artist, two to a row. Chips
 * sort it (recent, saved, with a chat, A–Z) and, once the shelf grows, a
 * search finds an artist by name or city.
 */
export function ArtistShelf({ artists, labels, locale }: { artists: (MyArtist & { cover: React.ReactNode })[]; labels: { recent: string; saved: string; chats: string; az: string; search: string; empty: string; none: string; savedBadge: string; chatBadge: string }; locale: string }) {
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let l = artists.filter((a) => !term || a.name.toLowerCase().includes(term) || (a.city ?? "").toLowerCase().includes(term));
    if (sort === "saved") l = l.filter((a) => a.saved);
    if (sort === "chats") l = l.filter((a) => a.chats > 0);
    if (sort === "az") l = [...l].sort((x, y) => x.name.localeCompare(y.name, locale));
    return l;
  }, [artists, q, sort, locale]);

  if (artists.length === 0) return <p className="px-5 pt-8 text-[0.95rem] leading-snug text-bone/60">{labels.empty}</p>;
  return (
    <div className="px-3 pb-6">
      <div className="flex gap-1.5 overflow-x-auto px-1 pt-4 pb-3 [scrollbar-width:none]">
        {(["recent", "saved", "chats", "az"] as Sort[]).map((k) => (
          <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={`h-9 shrink-0 rounded-full px-4 text-[0.84rem] font-semibold ${sort === k ? "bg-bone text-ink" : "bg-bone/[0.07] text-bone/80"}`}>
            {labels[k]}
          </button>
        ))}
      </div>
      {artists.length > 6 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} aria-label={labels.search} className="mx-1 mb-3 h-11 w-[calc(100%-0.5rem)] rounded-full border border-bone/15 bg-bone/[0.05] px-4 text-[0.95rem] text-bone placeholder:text-bone/40 focus:outline-none" />
      )}
      {list.length === 0 ? (
        <p className="px-2 pt-4 text-[0.92rem] text-bone/60">{labels.none}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
          {list.map((a) => (
            <li key={a.id} style={{ ["--accent" as string]: a.accent ?? "#c8231e" }}>
              <Link href={`/${a.slug}`} className="group block">
                {/* The magazine on the shelf: a slight lean, its shadow on the wood. */}
                <span className="relative block overflow-hidden rounded-[3px] shadow-[0_22px_34px_-18px_rgb(0_0_0/0.95)] transition-transform duration-300 group-active:scale-[0.97]">
                  {a.cover}
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/35 to-transparent" />
                </span>
                <span className="mt-2 flex items-center gap-1.5">
                  <span className="p-display min-w-0 flex-1 truncate text-[1.05rem] uppercase leading-none">{a.name}</span>
                  {a.saved && (
                    <span className="shrink-0 text-[0.8rem] text-accent" title={labels.savedBadge} aria-label={labels.savedBadge}>
                      ★
                    </span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-bone/55">
                  {a.city && <span className="truncate">{a.city}</span>}
                  {a.chats > 0 && <span className="shrink-0 rounded-full bg-accent/90 px-1.5 py-[1px] text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-bone">{labels.chatBadge}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
