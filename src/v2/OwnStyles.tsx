"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addSection, deleteSection, renameSection } from "@/app/studio/_legacy/actions";
import type { Dict } from "@/i18n";
import type { PortfolioSection } from "@/lib/queries";

/** The artist's own styles, named their way: they become the groups of their Obras. */
export function OwnStyles({ sections, t }: { sections: PortfolioSection[]; t: Dict }) {
  const r = t.v2.room.rooms;
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  return (
    <section className="v2-sheet grid gap-3 p-4">
      <p className="p-stamp text-bone/60">{r.ownStyles}</p>
      <p className="text-[0.85rem] text-bone-dim">{r.ownStylesLead}</p>
      {sections.length > 0 && (
        <ul className="grid divide-y divide-bone/10 border-y border-bone/10">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2.5">
              {editing === s.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) act(async () => (await renameSection(s.id, draft.trim()), setEditing(null)));
                  }}
                >
                  <input className="v2-input min-w-0 flex-1" maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <button type="submit" className="v2-btn" data-tone="accent" disabled={pending}>
                    {t.common.save}
                  </button>
                </form>
              ) : (
                <>
                  <span className="p-display min-w-0 flex-1 truncate text-[1.4rem] uppercase leading-none">{s.name}</span>
                  <button type="button" className="text-[0.82rem] text-bone/70 underline underline-offset-4" onClick={() => (setEditing(s.id), setDraft(s.name))}>
                    {r.rename}
                  </button>
                  <button type="button" className="text-[0.82rem] text-accent underline underline-offset-4" disabled={pending} onClick={() => act(async () => void (await deleteSection(s.id)))}>
                    {r.remove}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          act(() => addSection(n));
        }}
      >
        <input className="v2-input min-w-0 flex-1" maxLength={60} placeholder={r.newStyle} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="v2-btn" data-tone="accent" disabled={pending || !name.trim()}>
          + {r.add}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[0.88rem] text-accent">
          {error}
        </p>
      )}
    </section>
  );
}
