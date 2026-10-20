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

/** The notebook on the Sala's desk: a line to write on, the notes under it, pinned ones first, crossed-out ones faint. */
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
    <div className="v2-notebook">
      <form
        className="flex items-end gap-2 border-b border-[#2b2420]/30 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          act(() => addNote(body));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={r.notePlaceholder} className="p-quote min-w-0 flex-1 bg-transparent text-[1.25rem] text-[#2b2420] placeholder:text-[#2b2420]/40 focus:outline-none" />
        <button type="submit" disabled={pending || !text.trim()} className="shrink-0 rounded-full bg-[#2b2420] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#ece4d4] disabled:opacity-40">
          {r.noteAdd}
        </button>
      </form>
      <ul className="mt-2 grid">
        {notes.slice(0, 6).map((n) => (
          <li key={n.id} data-done={n.done} className="flex items-start gap-3 border-b border-[#2b2420]/15 py-2.5">
            <button type="button" onClick={() => act(() => setNote(n.id, { pinned: !n.pinned }))} aria-label={n.pinned ? r.unpin : r.pin} className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-[#2b2420] ${n.pinned ? "bg-[var(--accent)] border-[var(--accent)]" : ""}`} />
            <button type="button" onClick={() => act(() => setNote(n.id, { done: !n.done }))} className="p-quote min-w-0 flex-1 text-left text-[1.25rem] leading-snug">
              {n.body}
            </button>
            <button type="button" onClick={() => act(() => setNote(n.id, { remove: true }))} aria-label={r.removeNote} className="shrink-0 text-[0.9rem] text-[#2b2420]/40">
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
