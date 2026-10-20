"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { quickArtist } from "@/app/studio/_legacy/actions";
import { fill, type Dict, type Locale } from "@/i18n";
import { money } from "@/lib/format";

/**
 * Precios: one number, the booking amount. It fills in every quote the artist
 * sends (they can still change it on each one); under it, the stub of the
 * ticket the client receives, so they see how it reads.
 */
export function DepositForm({ cents, currency, artist, t, locale }: { cents: number | null; currency: string; artist: string; t: Dict; locale: Locale }) {
  const r = t.v2.room.rooms;
  const router = useRouter();
  const [value, setValue] = useState(cents != null ? String(cents / 100) : "100");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = Math.max(0, Number(value) || 0);
  const save = () =>
    start(async () => {
      setError(null);
      const res = await quickArtist({ default_deposit: amount });
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1800);
      }
    });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount > 0) save();
      }}
    >
      <label className="ed-tile block p-5">
        <span className="relative block">
          <span className="p-stamp block text-bone/60">{r.depositLabel}</span>
          <span className="mt-2 flex items-baseline gap-1">
            <span className="p-display text-[2.6rem] leading-none text-bone/50">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="p-display w-full min-w-0 bg-transparent text-[4.2rem] leading-none text-bone tabular-nums focus:outline-none"
              aria-label={r.depositLabel}
            />
            <span className="shrink-0 text-[0.85rem] text-bone/50">{currency.toUpperCase()}</span>
          </span>
          <span aria-hidden className="mt-2 block h-px bg-bone/15" />
        </span>
      </label>

      {/* The stub of the booking confirmation, as the client gets it. */}
      <div>
        <p className="p-stamp px-1 text-bone/50">{r.depositPreview}</p>
        <div className="relative mt-2 overflow-hidden rounded-[6px] bg-[#f3ecdf] px-5 py-4 text-[#2b2420] shadow-[0_22px_40px_-20px_rgb(0_0_0/0.85)]">
          <span className="p-grain" aria-hidden style={{ opacity: 0.35 }} />
          <span aria-hidden className="absolute inset-x-5 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
          <span className="relative grid gap-3">
            <span>
              <span className="block text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-[#2b2420]/60">{t.chat.offer.deposit}</span>
              <span className="mt-0.5 block font-[family-name:var(--font-cinzel)] text-[1.6rem] font-bold tabular-nums">{money(Math.round(amount * 100), currency, locale)}</span>
            </span>
            <span className="rounded-full px-4 py-2.5 text-center text-[0.85rem] font-semibold text-white" style={{ background: "var(--accent)" }}>
              {fill(t.chat.offer.take, { artist })}
            </span>
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[0.88rem] text-accent">
          {error}
        </p>
      )}
      <button type="submit" className="v2-btn" data-tone="accent" disabled={pending || amount <= 0}>
        {saved ? r.depositSaved : r.depositSave}
      </button>
    </form>
  );
}
