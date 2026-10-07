"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { preparePortfolioUploads, removePortrait, setPortrait } from "../actions";

/** Upload or remove the artist's cover photo (browser → storage → server action). */
export function CoverPhoto({ url, labels, storage }: { url: string | null; labels: { upload: string; replace: string; remove: string; hint: string; error: string }; storage: { url: string; anonKey: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await preparePortfolioUploads([{ type: file.type, size: file.size }]);
      if (!prepared) throw new Error();
      const target = prepared.targets[0];
      if (storage && target.token && target.bucket) {
        const supabase = (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey);
        const { error: e } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, file, { contentType: file.type });
        if (e) throw e;
      } else if (target.url) {
        const res = await fetch(target.url, { method: "PUT", body: file, headers: { "content-type": file.type } });
        if (!res.ok) throw new Error();
      }
      await setPortrait(prepared.token, target.key);
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
      <div className="relative aspect-[4/5] w-[140px] overflow-hidden rounded-[var(--radius-md)] border border-line bg-niche">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover object-top grayscale" />
        ) : null}
      </div>
      <div className="grid content-start gap-2">
        <p className="text-[0.85rem] text-ash-dim">{labels.hint}</p>
        <div className="flex flex-wrap gap-2">
          <label className={`btn btn-secondary btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
            {url ? labels.replace : labels.upload}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {url && (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-oxblood"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await removePortrait();
                router.refresh();
                setBusy(false);
              }}
            >
              {labels.remove}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[0.9rem] text-oxblood">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
