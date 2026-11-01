"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { preparePortfolioUploads, quickArtist, setPortrait } from "@/app/studio/_legacy/actions";
import { uploadFiles, type Storage } from "@/components/edit/upload";
import { fill, type Dict, type Locale } from "@/i18n";
import { STYLES } from "@/lib/catalog";
import type { Artist } from "@/lib/queries";

/** What the artist sets: who they are, their prices, their styles, the care sheets. Each block saves on its own. */
export type SettingsBlock = "account" | "prices" | "styles" | "care";

export function SettingsForm({ artist, storage, t, locale, only }: { artist: Artist; storage: Storage; t: Dict; locale: Locale; only?: SettingsBlock[] }) {
  const show = (b: SettingsBlock) => !only || only.includes(b);
  const s = t.v2.settings;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({
    display_name: artist.display_name,
    home_city: artist.home_city ?? "",
    headline: artist.headline ?? "",
    min_price: artist.min_price_cents != null ? String(artist.min_price_cents / 100) : "",
    default_deposit: artist.default_deposit_cents != null ? String(artist.default_deposit_cents / 100) : "100",
    accepting: artist.accepting,
    styles: artist.styles,
    precare: artist.precare ?? t.care.preDefault,
    postcare: artist.postcare ?? t.care.postDefault,
  });
  const set = (k: keyof typeof v, val: string | boolean | string[]) => setV((p) => ({ ...p, [k]: val }));
  const save = (block: string, patch: Parameters<typeof quickArtist>[0]) =>
    start(async () => {
      setError(null);
      const r = await quickArtist(patch);
      if (r?.error) setError(r.error);
      else {
        setDone(block);
        router.refresh();
        setTimeout(() => setDone(null), 1800);
      }
    });
  const upload = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      try {
        const up = await uploadFiles(preparePortfolioUploads, [file], storage);
        if (up) await setPortrait(up.token, up.keys[0]);
        router.refresh();
      } catch {
        setError(t.v2.edit.error);
      }
    });
  };
  const saveBtn = (block: string) => (
    <button type="submit" className="v2-btn mt-1 justify-self-start" data-tone="accent" disabled={pending}>
      {done === block ? s.saved : s.save}
    </button>
  );

  return (
    <div className={`grid gap-8 ${only ? "pt-2" : "pt-8"}`}>
      {show("account") && (
      <section>
        <p className="p-stamp text-bone/60">{s.account}</p>
        <form
          className="v2-sheet mt-2 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save("account", { display_name: v.display_name, home_city: v.home_city, headline: v.headline });
          }}
        >
          <div className="flex items-center gap-4">
            {artist.portrait_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.portrait_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-ink p-display text-[1.6rem] text-accent">{artist.display_name[0]}</span>
            )}
            <label className={`v2-btn cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`} data-tone="ghost">
              {t.studio.live.change}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          <label className="v2-field">
            <span>{s.name}</span>
            <input className="v2-input" maxLength={80} value={v.display_name} onChange={(e) => set("display_name", e.target.value)} />
          </label>
          <label className="v2-field">
            <span>{s.city}</span>
            <input className="v2-input" maxLength={80} value={v.home_city} onChange={(e) => set("home_city", e.target.value)} />
          </label>
          <label className="v2-field">
            <span>{s.headline}</span>
            <input className="v2-input" maxLength={140} value={v.headline} onChange={(e) => set("headline", e.target.value)} />
          </label>
          {saveBtn("account")}
        </form>
      </section>
      )}

      {show("prices") && (
      <section>
        {!only && <p className="p-stamp text-bone/60">{s.prices}</p>}
        <form
          className="v2-sheet mt-2 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save("prices", { min_price: Number(v.min_price) || 0, default_deposit: Number(v.default_deposit) || 0, accepting: v.accepting });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="v2-field">
              <span>{fill(s.from, { currency: artist.currency.toUpperCase() })}</span>
              <input type="number" inputMode="decimal" className="v2-input" min={0} value={v.min_price} onChange={(e) => set("min_price", e.target.value)} />
            </label>
            <label className="v2-field">
              <span>{fill(s.deposit, { currency: artist.currency.toUpperCase() })}</span>
              <input type="number" inputMode="decimal" className="v2-input" min={0} value={v.default_deposit} onChange={(e) => set("default_deposit", e.target.value)} />
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-[14px] border border-bone/15 px-4 py-3">
            <span>
              <span className="block text-[0.95rem]">{s.accepting}</span>
              <span className="block text-[0.78rem] text-bone-dim">{s.acceptingHint}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={v.accepting} onChange={(e) => set("accepting", e.target.checked)} />
          </label>
          {saveBtn("prices")}
        </form>
      </section>
      )}

      {show("styles") && (
      <section>
        {!only && <p className="p-stamp text-bone/60">{s.styles}</p>}
        <form
          className="v2-sheet mt-2 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save("styles", { styles: v.styles });
          }}
        >
          <div className="v2-field">
            <span>{s.stylesCatalog}</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.filter((x) => x.slug !== "other").map((x) => {
                const on = v.styles.includes(x.slug);
                return (
                  <button key={x.slug} type="button" aria-pressed={on} onClick={() => set("styles", on ? v.styles.filter((y) => y !== x.slug) : [...v.styles, x.slug])} className={`rounded-full border px-3 py-1.5 text-[0.82rem] ${on ? "border-bone bg-bone text-ink" : "border-bone/25 text-bone"}`}>
                    {x.label[locale]}
                  </button>
                );
              })}
            </div>
          </div>
          {saveBtn("styles")}
        </form>
      </section>
      )}

      {show("care") && (
      <section>
        <p className="p-stamp text-bone/60">{s.care}</p>
        <form
          className="v2-sheet mt-2 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save("care", { precare: v.precare, postcare: v.postcare });
          }}
        >
          <label className="v2-field">
            <span>{s.precare}</span>
            <textarea className="v2-input" maxLength={4000} value={v.precare} onChange={(e) => set("precare", e.target.value)} />
            <span className="text-[0.78rem] normal-case tracking-normal text-bone-dim">{s.precareHint}</span>
          </label>
          <label className="v2-field">
            <span>{s.postcare}</span>
            <textarea className="v2-input" maxLength={4000} value={v.postcare} onChange={(e) => set("postcare", e.target.value)} />
            <span className="text-[0.78rem] normal-case tracking-normal text-bone-dim">{s.postcareHint}</span>
          </label>
          {saveBtn("care")}
        </form>
      </section>
      )}
      {error && (
        <p role="alert" className="text-[0.88rem] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
