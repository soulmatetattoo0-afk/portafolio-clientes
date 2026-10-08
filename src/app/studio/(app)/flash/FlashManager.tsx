"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PlanLock } from "@/components/PlanLock";
import type { Locale } from "@/i18n";
import { money } from "@/lib/format";
import type { FlashItem } from "@/lib/queries";

import { addFlashItems, deleteFlashItem, preparePortfolioUploads, updateFlashItem } from "../actions";

interface Labels {
  upload: string;
  uploadHint: string;
  empty: string;
  name: string;
  description: string;
  size: string;
  sizeHint: string;
  price: string;
  status: string;
  statuses: Record<FlashItem["status"], string>;
  repeatable: string;
  published: string;
  delete: string;
  deleteConfirm: string;
  cancel: string;
  save: string;
  saved: string;
  error: string;
  locked: string;
  upgrade: string;
}

export function FlashManager({ items, locale, labels, storage, locked = false }: { items: FlashItem[]; locale: Locale; labels: Labels; storage: { url: string; anonKey: string } | null; locked?: boolean }) {
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
      const r = await addFlashItems(
        prepared.token,
        prepared.targets.map((t) => t.key),
      );
      if (r?.error) throw new Error(r.error);
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      {locked ? (
        <PlanLock text={labels.locked} cta={labels.upgrade} />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <label className={`btn btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
            {labels.upload}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          </label>
          <p className="text-[0.88rem] text-ash-dim">{labels.uploadHint}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-oxblood">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-line p-10 text-center text-ash">{labels.empty}</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (locked ? <Still key={item.id} item={item} locale={locale} labels={labels} /> : <Item key={item.id} item={item} locale={locale} labels={labels} />))}
        </ul>
      )}
    </div>
  );
}

/** A design as the page shows it, with nothing to edit: the list stays, the controls wait for Full. */
function Still({ item, locale, labels }: { item: FlashItem; locale: Locale; labels: Labels }) {
  return (
    <li className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-niche">
      <div className="relative aspect-[4/4.2] bg-soot">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title} className={`h-full w-full object-cover ${item.published ? "" : "opacity-40"}`} loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center font-serif text-[1.3rem] italic">{item.title}</div>
        )}
        <span className={`pill absolute top-3 left-3 bg-soot/80 ${item.status === "available" ? "text-verdigris" : item.status === "reserved" ? "text-ember" : "text-ash"}`}>{labels.statuses[item.status]}</span>
      </div>
      <div className="grid gap-1 p-4">
        <p className="font-serif text-[1.15rem] leading-tight">{item.title}</p>
        <p className="t-num text-[0.88rem] text-ash">{[item.size_label, item.price_cents != null ? money(item.price_cents, item.currency, locale) : null].filter(Boolean).join(" · ")}</p>
      </div>
    </li>
  );
}

function Item({ item, locale, labels }: { item: FlashItem; locale: Locale; labels: Labels }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [v, setV] = useState({
    title: item.title,
    description: item.description ?? "",
    size_label: item.size_label ?? "",
    price: item.price_cents != null ? String(item.price_cents / 100) : "",
    status: item.status,
    repeatable: item.repeatable,
    published: item.published,
  });
  const save = (next: typeof v) => {
    setV(next);
    setSaved(false);
    start(async () => {
      const r = await updateFlashItem(item.id, next);
      setNote(r?.error ?? null);
      setSaved(!r?.error);
    });
  };
  const field = "input min-h-10 py-1.5";
  return (
    <li className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-niche" aria-busy={pending}>
      <div className="relative aspect-[4/4.2] bg-soot">
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title} className={`h-full w-full object-cover ${v.published ? "" : "opacity-40"}`} loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center font-serif text-[1.3rem] italic">{v.title}</div>
        )}
        <span className={`pill absolute top-3 left-3 bg-soot/80 ${v.status === "available" ? "text-verdigris" : v.status === "reserved" ? "text-ember" : "text-ash"}`}>{labels.statuses[v.status]}</span>
      </div>
      <form
        className="grid gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(v);
        }}
      >
        <label className="grid gap-1">
          <span className="t-label">{labels.name}</span>
          <input className={field} value={v.title} maxLength={80} onChange={(e) => setV({ ...v, title: e.target.value })} onBlur={() => save(v)} />
        </label>
        <label className="grid gap-1">
          <span className="t-label">{labels.description}</span>
          <textarea className="input min-h-20" value={v.description} maxLength={500} onChange={(e) => setV({ ...v, description: e.target.value })} onBlur={() => save(v)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="t-label">{labels.size}</span>
            <input className={field} value={v.size_label} maxLength={40} placeholder={labels.sizeHint} onChange={(e) => setV({ ...v, size_label: e.target.value })} onBlur={() => save(v)} />
          </label>
          <label className="grid gap-1">
            <span className="t-label">
              {labels.price} {item.price_cents != null ? <span className="text-ash-dim">({money(item.price_cents, item.currency, locale)})</span> : null}
            </span>
            <input className={field} type="number" min={0} step={1} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} onBlur={() => save(v)} />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="t-label">{labels.status}</span>
          <select className={field} value={v.status} onChange={(e) => save({ ...v, status: e.target.value as FlashItem["status"] })}>
            {(["available", "reserved", "taken"] as const).map((st) => (
              <option key={st} value={st}>
                {labels.statuses[st]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4" checked={v.repeatable} onChange={(e) => save({ ...v, repeatable: e.target.checked })} />
          {labels.repeatable}
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4" checked={v.published} onChange={(e) => save({ ...v, published: e.target.checked })} />
          {labels.published}
        </label>
        <div className="flex items-center justify-between gap-3">
          <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
            {labels.save}
          </button>
          <span className={`text-[0.85rem] ${note ? "text-oxblood" : "text-verdigris"}`} role="status">
            {note ?? (saved && !pending ? labels.saved : "")}
          </span>
        </div>
        {confirming ? (
          <div className="grid gap-2 rounded-[var(--radius-sm)] border border-oxblood/40 p-3">
            <p className="text-[0.9rem]">{labels.deleteConfirm}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => start(() => deleteFlashItem(item.id))}>
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
      </form>
    </li>
  );
}
