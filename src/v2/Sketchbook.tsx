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

/** The artist's notes: a line to write on, the notes under it, pinned ones first, crossed-out ones faint. */
export function Sketchbook({ notes, t }: { notes: Note[]; t: Dict }) {
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
    <div className="grid gap-1">
      <form
        className="flex items-center gap-2 rounded-full border border-bone/20 bg-ink/40 py-1 pr-1 pl-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          act(() => addNote(body));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={r.notePlaceholder} className="min-w-0 flex-1 bg-transparent py-2 text-[0.95rem] text-bone placeholder:text-bone/40 focus:outline-none" />
        <button type="submit" disabled={pending || !text.trim()} className="shrink-0 rounded-full bg-bone px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink disabled:opacity-40">
          {r.noteAdd}
        </button>
      </form>
      {notes.length > 0 && (
        <ul className="mt-1 grid divide-y divide-bone/10">
          {notes.slice(0, 6).map((n) => (
            <li key={n.id} className={`flex items-start gap-3 py-2.5 ${n.done ? "opacity-45" : ""}`}>
              <button type="button" onClick={() => act(() => setNote(n.id, { done: !n.done }))} aria-label={n.done ? r.undo : r.done} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] ${n.done ? "border-bone bg-bone text-ink" : "border-bone/50"}`}>
                {n.done && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                )}
              </button>
              <span className={`min-w-0 flex-1 text-[0.95rem] leading-snug ${n.done ? "line-through" : ""}`}>{n.body}</span>
              <button type="button" onClick={() => act(() => setNote(n.id, { pinned: !n.pinned }))} aria-label={n.pinned ? r.unpin : r.pin} className={`shrink-0 text-[0.9rem] ${n.pinned ? "text-accent" : "text-bone/30"}`}>
                ★
              </button>
              <button type="button" onClick={() => act(() => setNote(n.id, { remove: true }))} aria-label={r.removeNote} className="shrink-0 text-[0.95rem] text-bone/30">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
