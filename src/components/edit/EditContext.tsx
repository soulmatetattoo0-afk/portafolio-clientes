"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { Storage } from "./upload";

/**
 * Editing the page in place. The artist sees their page exactly as a client
 * does; a pencil sits on everything they can change. A tap opens a short
 * sheet with just the fields that thing has (write, upload, pick, switch),
 * saves, and the page refreshes under it so the change shows at once.
 */
export type Field =
  | { kind: "text" | "textarea"; key: string; label: string; value: string; max?: number; hint?: string }
  | { kind: "date" | "time"; key: string; label: string; value: string }
  | { kind: "select"; key: string; label: string; value: string; options: { value: string; label: string }[] }
  | { kind: "toggle"; key: string; label: string; value: boolean; hint?: string }
  | { kind: "image"; key: string; label: string; url: string | null; upload: (file: File) => Promise<void>; remove?: () => Promise<void>; wide?: boolean }
  | { kind: "pick"; key: string; label: string; value: string | null; options: { value: string; url: string }[] }
  | { kind: "link"; label: string; href: string; hint?: string };

export interface EditSpec {
  title: string;
  fields: Field[];
  /** Saves the values of every text, select, toggle, date and pick field, by key. */
  save?: (values: Record<string, string | boolean>) => Promise<{ error?: string } | void>;
  /** Something that can be taken away (a photo, a city), behind a confirmation. */
  remove?: { label: string; confirm: string; run: () => Promise<unknown> };
}

export interface EditLabels {
  edit: string;
  save: string;
  cancel: string;
  saving: string;
  change: string;
  upload: string;
  remove: string;
  confirm: string;
  error: string;
  hint: string;
}

interface Edit {
  on: boolean;
  storage: Storage;
  labels: EditLabels;
  open: (spec: EditSpec) => void;
}

const Ctx = createContext<Edit | null>(null);

/** Null on the public page; the editing tools on the artist's own copy of it. */
export const useEdit = () => useContext(Ctx);

export function EditProvider({ storage, labels, children }: { storage: Storage; labels: EditLabels; children: React.ReactNode }) {
  const [spec, setSpec] = useState<EditSpec | null>(null);
  return (
    <Ctx.Provider value={{ on: true, storage, labels, open: setSpec }}>
      {children}
      {spec && <EditSheet spec={spec} labels={labels} onClose={() => setSpec(null)} />}
    </Ctx.Provider>
  );
}

function EditSheet({ spec, labels, onClose }: { spec: EditSpec; labels: EditLabels; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const v: Record<string, string | boolean> = {};
    for (const f of spec.fields) if ("key" in f && f.kind !== "image") v[f.key] = f.kind === "pick" ? (f.value ?? "") : f.value;
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<{ error?: string } | void | unknown>, close = true) => {
    setBusy(true);
    setError(null);
    try {
      const res = (await fn()) as { error?: string } | void;
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      if (close) onClose();
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="poster fixed inset-0 z-[80] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise max-h-[88svh] w-full max-w-[440px] overflow-y-auto rounded-t-[1.6rem] border border-line bg-ink-2 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-bone sm:rounded-[1.6rem]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-bone/20 sm:hidden" />
        <p className="p-display text-[1.6rem] leading-none">{spec.title}</p>
        <div className="mt-4 grid gap-4">
          {spec.fields.map((f, i) => {
            if (f.kind === "link")
              return (
                <a key={i} href={f.href} className="flex h-12 items-center justify-between rounded-full border border-bone/25 px-4 text-[0.92rem] font-semibold">
                  <span>
                    {f.label}
                    {f.hint && <span className="block text-[0.75rem] font-normal text-bone-dim">{f.hint}</span>}
                  </span>
                  <span aria-hidden>›</span>
                </a>
              );
            if (f.kind === "image")
              return (
                <div key={f.key} className="grid gap-2">
                  <span className="p-stamp text-bone/70">{f.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`relative shrink-0 overflow-hidden rounded-[12px] bg-ink ${f.wide ? "aspect-[16/10] w-32" : "aspect-[4/5] w-20"}`}>
                      {f.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                    </span>
                    <div className="grid gap-2">
                      <label className={`flex h-11 cursor-pointer items-center justify-center rounded-full bg-bone px-4 text-[0.88rem] font-semibold text-ink ${busy ? "pointer-events-none opacity-60" : ""}`}>
                        {f.url ? labels.change : labels.upload}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void run(() => f.upload(file), false);
                          }}
                        />
                      </label>
                      {f.url && f.remove && (
                        <button type="button" className="text-[0.82rem] text-bone-dim underline underline-offset-4" disabled={busy} onClick={() => run(() => f.remove!(), false)}>
                          {labels.remove}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            if (f.kind === "pick")
              return (
                <div key={f.key} className="grid gap-2">
                  <span className="p-stamp text-bone/70">{f.label}</span>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {f.options.map((o) => (
                      <button key={o.value} type="button" aria-pressed={values[f.key] === o.value} onClick={() => set(f.key, o.value)} className={`relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-[12px] ring-2 ${values[f.key] === o.value ? "ring-accent" : "ring-transparent"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            if (f.kind === "toggle")
              return (
                <label key={f.key} className="flex items-center justify-between gap-3 rounded-[14px] border border-line px-4 py-3">
                  <span>
                    <span className="block text-[0.95rem]">{f.label}</span>
                    {f.hint && <span className="block text-[0.78rem] text-bone-dim">{f.hint}</span>}
                  </span>
                  <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                </label>
              );
            if (f.kind === "select")
              return (
                <label key={f.key} className="grid gap-1.5">
                  <span className="p-stamp text-bone/70">{f.label}</span>
                  <select className="input" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            if (f.kind === "textarea")
              return (
                <label key={f.key} className="grid gap-1.5">
                  <span className="p-stamp text-bone/70">{f.label}</span>
                  <textarea className="input min-h-24" maxLength={f.max} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                  {f.hint && <span className="text-[0.78rem] text-bone-dim">{f.hint}</span>}
                </label>
              );
            return (
              <label key={f.key} className="grid gap-1.5">
                <span className="p-stamp text-bone/70">{f.label}</span>
                <input type={f.kind === "text" ? "text" : f.kind} className="input" maxLength={f.kind === "text" ? f.max : undefined} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                {f.kind === "text" && f.hint && <span className="text-[0.78rem] text-bone-dim">{f.hint}</span>}
              </label>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[0.88rem] text-accent">
            {error}
          </p>
        )}
        <div className="mt-5 grid gap-2">
          {spec.save && (
            <button type="button" className="flex h-12 items-center justify-center rounded-full bg-accent text-[0.95rem] font-semibold text-ink disabled:opacity-60" disabled={busy} onClick={() => run(() => spec.save!(values))}>
              {busy ? labels.saving : labels.save}
            </button>
          )}
          {spec.remove &&
            (confirming ? (
              <div className="grid gap-2 rounded-[14px] border border-accent/50 p-3 text-center">
                <p className="text-[0.9rem]">{spec.remove.confirm}</p>
                <button type="button" className="h-11 rounded-full border border-accent text-[0.9rem] font-semibold text-accent" disabled={busy} onClick={() => run(() => spec.remove!.run())}>
                  {labels.confirm}
                </button>
              </div>
            ) : (
              <button type="button" className="h-11 text-[0.88rem] text-bone-dim underline underline-offset-4" onClick={() => setConfirming(true)}>
                {spec.remove.label}
              </button>
            ))}
          <button type="button" className="h-11 text-[0.88rem] text-bone-dim" onClick={onClose}>
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
