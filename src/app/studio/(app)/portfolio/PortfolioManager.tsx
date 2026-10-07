"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Locale } from "@/i18n";
import { STYLES } from "@/lib/catalog";
import type { PortfolioItem } from "@/lib/queries";

import { addPortfolioItems, deletePortfolioItem, preparePortfolioUploads, updatePortfolioItem } from "../actions";

interface Labels {
  upload: string;
  uploadHint: string;
  empty: string;
  style: string;
  color: string;
  healed: string;
  published: string;
  pieceTitle: string;
  featured: string;
  featuredHint: string;
  story: string;
  storyHint: string;
  delete: string;
  deleteConfirm: string;
  cancel: string;
  blackGrey: string;
  colour: string;
  none: string;
  error: string;
}

export function PortfolioManager({ items, locale, labels, storage }: { items: PortfolioItem[]; locale: Locale; labels: Labels; storage: { url: string; anonKey: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const list = Array.from(files).filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024).slice(0, 20);
      const prepared = await preparePortfolioUploads(list.map((f) => ({ type: f.type, size: f.size })));
      if (!prepared) throw new Error();
      const supabase = storage ? (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey) : null;
      await Promise.all(
        prepared.targets.map(async (target, i) => {
          if (supabase && target.token && target.bucket) {
            const { error: e } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, list[i], { contentType: list[i].type });
            if (e) throw e;
          } else if (target.url) {
            const res = await fetch(target.url, { method: "PUT", body: list[i], headers: { "content-type": list[i].type } });
            if (!res.ok) throw new Error();
          }
        }),
      );
      await addPortfolioItems(
        prepared.token,
        prepared.targets.map((t) => t.key),
      );
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className={`btn btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
          {labels.upload}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
        </label>
        <p className="text-[0.88rem] text-ash-dim">{labels.uploadHint}</p>
      </div>
      {error && (
        <p role="alert" className="text-oxblood">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-line p-10 text-center text-ash">{labels.empty}</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Item key={item.id} item={item} locale={locale} labels={labels} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({ item, locale, labels }: { item: PortfolioItem; locale: Locale; labels: Labels }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [v, setV] = useState({
    title: item.title ?? "",
    style: item.style ?? "",
    color_mode: (item.color_mode ?? "") as "" | "black_grey" | "color",
    is_healed: item.is_healed,
    published: item.published,
    featured: item.featured,
    story: item.story ?? "",
  });
  // Text fields save when the artist leaves them, not on every keystroke.
  const edit = (next: typeof v) => setV(next);
  const commit = () => start(() => updatePortfolioItem(item.id, v));
  const save = (next: typeof v) => {
    setV(next);
    start(() => updatePortfolioItem(item.id, next));
  };
  return (
    <li className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-niche" aria-busy={pending}>
      <div className="relative aspect-[4/5] bg-soot">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title ?? ""} className={`h-full w-full object-cover ${v.published ? "" : "opacity-40"}`} loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center font-serif text-[1.3rem] italic">{item.title}</div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <label className="grid gap-1">
          <span className="t-label">{labels.pieceTitle}</span>
          <input className="input" value={v.title} maxLength={120} onChange={(e) => edit({ ...v, title: e.target.value })} onBlur={commit} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="t-label">{labels.style}</span>
            <select className="input min-h-10 py-1.5" value={v.style} onChange={(e) => save({ ...v, style: e.target.value })}>
              <option value="">{labels.none}</option>
              {STYLES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label[locale]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="t-label">{labels.color}</span>
            <select className="input min-h-10 py-1.5" value={v.color_mode} onChange={(e) => save({ ...v, color_mode: e.target.value as typeof v.color_mode })}>
              <option value="">{labels.none}</option>
              <option value="black_grey">{labels.blackGrey}</option>
              <option value="color">{labels.colour}</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4" checked={v.is_healed} onChange={(e) => save({ ...v, is_healed: e.target.checked })} />
          {labels.healed}
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4" checked={v.published} onChange={(e) => save({ ...v, published: e.target.checked })} />
          {labels.published}
        </label>
        <div className="grid gap-2 rounded-[var(--radius-sm)] border border-line p-3">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" className="h-4 w-4" checked={v.featured} onChange={(e) => save({ ...v, featured: e.target.checked })} />
            {labels.featured}
          </label>
          <p className="text-[0.82rem] text-ash-dim">{labels.featuredHint}</p>
          {v.featured && (
            <label className="grid gap-1">
              <span className="t-label">{labels.story}</span>
              <textarea className="input min-h-24" value={v.story} maxLength={1200} placeholder={labels.storyHint} onChange={(e) => edit({ ...v, story: e.target.value })} onBlur={commit} />
            </label>
          )}
        </div>
        {confirming ? (
          <div className="grid gap-2 rounded-[var(--radius-sm)] border border-oxblood/40 p-3">
            <p className="text-[0.9rem]">{labels.deleteConfirm}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => start(() => deletePortfolioItem(item.id))}>
                {labels.delete}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                {labels.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm justify-self-start px-0 text-oxblood" onClick={() => setConfirming(true)}>
            {labels.delete}
          </button>
        )}
      </div>
    </li>
  );
}
