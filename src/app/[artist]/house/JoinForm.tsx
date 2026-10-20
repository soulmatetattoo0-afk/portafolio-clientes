"use client";

import { useState, useTransition } from "react";

import { fill, type Dict } from "@/i18n";
import type { StudioFrontData } from "@/lib/studio-front";

import { applyToStudio, prepareJoinUploads } from "./actions";

const MAX = 6;

/** Shrink a photo to a long side of 1600 px before it leaves the phone. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

/** An artist asks to join: who they are, how long they've tattooed, guest or resident, and their work. */
export function JoinForm({ studio, t, storage }: { studio: StudioFrontData; t: Dict; storage: { url: string; anonKey: string } | null }) {
  const j = t.house.join;
  const [role, setRole] = useState<"guest" | "resident">("guest");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const add = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) if (next.length < MAX && f.type.startsWith("image/")) next.push({ file: f, url: URL.createObjectURL(f) });
    setPhotos(next);
  };

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      try {
        let uploadToken: string | null = null;
        const keys: string[] = [];
        if (photos.length) {
          const blobs = await Promise.all(photos.map((p) => shrink(p.file)));
          const prepared = await prepareJoinUploads(studio.slug, blobs.map((b) => ({ kind: "reference" as const, type: b.type || "image/jpeg", size: b.size })));
          if ("error" in prepared) throw new Error(prepared.error);
          uploadToken = prepared.token;
          const supabase = storage ? (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey) : null;
          await Promise.all(
            prepared.targets.map(async (target, i) => {
              const blob = blobs[i];
              if (supabase && target.token && target.bucket) {
                const { error: e } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, blob, { contentType: blob.type });
                if (e) throw new Error(j.errorUpload);
              } else if (target.url) {
                const res = await fetch(target.url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
                if (!res.ok) throw new Error(j.errorUpload);
              }
              keys.push(target.key);
            }),
          );
        }
        const links = String(form.get("links") ?? "")
          .split(/\s+/)
          .map((l) => l.trim())
          .filter(Boolean);
        const res = await applyToStudio({
          studioSlug: studio.slug,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          years: Number(form.get("years") ?? 0),
          role,
          message: String(form.get("message") ?? ""),
          links,
          uploadToken,
          files: keys,
        });
        if ("error" in res) setError(res.error);
        else setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.common.error);
      }
    });

  if (done)
    return (
      <div className="mx-auto max-w-xl px-5 pb-10 pt-10">
        <h2 className="p-display text-[clamp(2.2rem,10vw,3.4rem)] leading-[0.9]">{j.title}</h2>
        <p role="status" className="mt-5 rounded-[18px] border border-bone/20 bg-ink-2 p-4 text-[1rem] leading-snug">
          {fill(j.done, { studio: studio.name })}
        </p>
      </div>
    );

  return (
    <form action={submit} className="mx-auto grid max-w-xl gap-5 px-5 pb-12 pt-6">
      <div>
        <h2 className="p-display text-[clamp(2.2rem,10vw,3.4rem)] leading-[0.9]">{j.title}</h2>
        <p className="mt-3 text-bone/80">{fill(j.lead, { studio: studio.name })}</p>
      </div>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone/70">{j.name}</span>
        <input name="name" required maxLength={120} autoComplete="name" className="input" />
      </label>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone/70">{j.email}</span>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone/70">{j.years}</span>
        <input name="years" type="number" inputMode="numeric" min={0} max={60} required className="input w-32" />
      </label>
      <fieldset className="grid gap-2">
        <legend className="p-stamp mb-1.5 text-bone/70">{j.role}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["guest", "resident"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`rounded-[18px] border p-3 text-left transition-colors ${role === r ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]" : "border-bone/20"}`}
            >
              <span className="p-display block text-[1.5rem] leading-none">{j[r]}</span>
              <span className="mt-1 block text-[0.82rem] text-bone/70">{r === "guest" ? j.guestHint : j.residentHint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <span className="p-stamp text-bone/70">{j.work}</span>
        <p className="text-[0.85rem] text-bone/60">{j.workHint}</p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-[12px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-bone" aria-label={j.remove}>
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-bone/30 text-center text-[0.8rem] text-bone/70">
              <span className="text-[1.6rem] leading-none">+</span>
              {j.add}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
            </label>
          )}
        </div>
      </div>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone/70">{j.links}</span>
        <textarea name="links" rows={2} placeholder={j.linksHint} className="input" />
      </label>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone/70">{j.message}</span>
        <textarea name="message" rows={3} maxLength={2000} className="input" />
      </label>
      {error && (
        <p role="alert" className="text-[0.9rem] text-ember">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="p-key h-[76px] w-full">
        <span className="p-key-side" aria-hidden />
        <span className="p-key-cap">
          <span className="p-key-word p-display text-[1.6rem]">{pending ? j.sending : j.send}</span>
        </span>
      </button>
    </form>
  );
}
