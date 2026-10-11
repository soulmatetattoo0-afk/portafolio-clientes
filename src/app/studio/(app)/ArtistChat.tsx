"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Thread } from "@/components/chat/Thread";
import type { Dict, Locale } from "@/i18n";
import type { ChatItem } from "@/lib/chat";

import { markArtistRead, offerReservation, sendArtistMessage } from "./actions";

/**
 * The artist's side of the conversation: answer, agree the idea and the day,
 * then offer the reservation: the date, the estimate and the first payment.
 */
export function ArtistChat({
  briefId,
  items,
  names,
  t,
  locale,
  stops,
  currency,
  canOffer,
}: {
  briefId: string;
  items: ChatItem[];
  names: { client: string; artist: string };
  t: Dict["chat"];
  locale: Locale;
  stops: { id: string; label: string }[];
  currency: string;
  canOffer: boolean;
}) {
  const [offering, setOffering] = useState(false);
  const count = items.length;
  useEffect(() => {
    void markArtistRead(briefId);
  }, [briefId, count]);

  return (
    <Thread
      items={items}
      side="artist"
      names={names}
      t={t}
      locale={locale}
      pinned={null}
      onSend={(text) => sendArtistMessage(briefId, text)}
      tools={
        canOffer ? (
          offering ? (
            <OfferForm briefId={briefId} t={t} stops={stops} currency={currency} onDone={() => setOffering(false)} />
          ) : (
            <button type="button" className="btn btn-secondary justify-self-start" onClick={() => setOffering(true)}>
              {t.offerForm.open}
            </button>
          )
        ) : null
      }
    />
  );
}

function OfferForm({ briefId, t, stops, currency, onDone }: { briefId: string; t: Dict["chat"]; stops: { id: string; label: string }[]; currency: string; onDone: () => void }) {
  const f = t.offerForm;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ date: "", time: "12:00", hours: "3", stopId: stops[0]?.id ?? "", price: "", deposit: "", message: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);
  const cur = currency.toUpperCase();

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await offerReservation(briefId, v);
      if (res?.error) setError(res.error);
      else {
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-3 rounded-[var(--radius-md)] border border-gilt/50 bg-niche p-4">
      <div>
        <p className="font-semibold">{f.title}</p>
        <p className="mt-1 text-[0.88rem] text-ash">{f.lead}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-[0.85rem]">
          <span className="t-label">{f.date}</span>
          <input type="date" className="input" min={today} value={v.date} onChange={set("date")} required />
        </label>
        <label className="grid gap-1 text-[0.85rem]">
          <span className="t-label">{f.time}</span>
          <input type="time" className="input" value={v.time} onChange={set("time")} required />
        </label>
        <label className="grid gap-1 text-[0.85rem]">
          <span className="t-label">{f.hours}</span>
          <input type="number" className="input" min={1} max={14} step={0.5} value={v.hours} onChange={set("hours")} />
        </label>
        {stops.length > 1 ? (
          <label className="grid gap-1 text-[0.85rem]">
            <span className="t-label">{f.place}</span>
            <select className="input" value={v.stopId} onChange={set("stopId")}>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid gap-1 text-[0.85rem]">
            <span className="t-label">{f.place}</span>
            <span className="flex min-h-11 items-center text-vellum">{stops[0]?.label}</span>
          </div>
        )}
        <label className="col-span-1 grid gap-1 text-[0.85rem] sm:col-span-2">
          <span className="t-label">
            {f.price} ({cur})
          </span>
          <input type="number" inputMode="decimal" className="input t-num" min={1} value={v.price} onChange={set("price")} required />
        </label>
        <label className="col-span-1 grid gap-1 text-[0.85rem] sm:col-span-2">
          <span className="t-label">
            {f.deposit} ({cur})
          </span>
          <input type="number" inputMode="decimal" className="input t-num" min={1} value={v.deposit} onChange={set("deposit")} required />
        </label>
      </div>
      <p className="text-[0.8rem] text-ash">{f.depositHint}</p>
      <label className="grid gap-1 text-[0.85rem]">
        <span className="t-label">{f.message}</span>
        <textarea className="input min-h-20" maxLength={1000} value={v.message} onChange={set("message")} />
      </label>
      {error && (
        <p role="alert" className="text-[0.88rem] text-oxblood">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending || !v.date || !v.price || !v.deposit}>
          {f.send}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {f.cancel}
        </button>
      </div>
    </div>
  );
}
