"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addNote, setNote } from "@/app/studio/_legacy/actions";
import type { Dict } from "@/i18n";

export interface Note {
  id: string;
  body: string;
  pinned: boolean;
  done: boolean;
}

/**
 * The artist's notebook: a spiral-bound page with blue rules and a margin in
 * their colour. Notes are written on the lines in ink; a tick crosses one out
 * with a stroke of the pen, the star pins it to the top.
 */
export function Sketchbook({ notes, t, today }: { notes: Note[]; t: Dict; today: string }) {
  const r = t.v2.room;
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <div className="v2-notebook">
      {/* The spiral: punched holes and the wire over the top edge. */}
      <span aria-hidden className="pointer-events-none absolute -top-3 inset-x-4 flex justify-between">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="relative block h-7 w-3">
            <span className="absolute bottom-0 left-[1px] h-2.5 w-2.5 rounded-full bg-[#1c1916] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]" />
            <span className="absolute bottom-[5px] left-[3px] h-6 w-[7px] rounded-full border-2 border-[#bdb4a9] border-r-[#7d756c] bg-transparent" />
          </span>
        ))}
      </span>
      <p className="absolute top-4 right-4 font-[family-name:var(--font-cormorant)] text-[1rem] italic text-[#2b2420]/55">{today}</p>
      <form
        className="flex h-[var(--line)] items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          act(() => addNote(body));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={r.notePlaceholder} aria-label={r.notePlaceholder} className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-cormorant)] text-[1.2rem] italic text-[#1f2a44] placeholder:text-[#2b2420]/35 focus:outline-none" />
        <button type="submit" disabled={pending || !text.trim()} aria-label={r.noteAdd} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2b2420] text-[#f4eedf] transition-opacity disabled:opacity-25">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M13.5 3.5l3 3L7 16H4v-3zM11.5 5.5l3 3" />
          </svg>
        </button>
      </form>
      {notes.length === 0 ? (
        <p className="h-[var(--line)] font-[family-name:var(--font-cormorant)] text-[1.1rem] leading-[var(--line)] italic text-[#2b2420]/40">{r.notesEmpty}</p>
      ) : (
        <ul>
          {notes.slice(0, 8).map((n) => (
            <li key={n.id} className="group relative flex items-start gap-2">
              {/* The tick sits in the margin, left of the red line. */}
              <button type="button" onClick={() => act(() => setNote(n.id, { done: !n.done }))} aria-label={n.done ? r.undo : r.done} className="absolute top-[calc((var(--line)-1.1rem)/2)] -left-[2.45rem] grid h-[1.1rem] w-[1.1rem] place-items-center rounded-[3px] border-[1.5px] border-[#2b2420]/55">
                {n.done && (
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 -translate-y-[2px] translate-x-[1px]" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1.5 6.5l3 3L11 1.5" />
                  </svg>
                )}
              </button>
              <span className={`min-w-0 flex-1 font-[family-name:var(--font-cormorant)] text-[1.2rem] leading-[var(--line)] italic text-[#1f2a44] ${n.done ? "text-[#1f2a44]/45 line-through decoration-[var(--accent)] decoration-2" : ""}`}>{n.body}</span>
              <button type="button" onClick={() => act(() => setNote(n.id, { pinned: !n.pinned }))} aria-label={n.pinned ? r.unpin : r.pin} className={`h-[var(--line)] shrink-0 px-0.5 text-[1rem] ${n.pinned ? "text-accent" : "text-[#2b2420]/25"}`}>
                ★
              </button>
              <button type="button" onClick={() => act(() => setNote(n.id, { remove: true }))} aria-label={r.removeNote} className="h-[var(--line)] shrink-0 px-0.5 text-[1.05rem] text-[#2b2420]/30">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
