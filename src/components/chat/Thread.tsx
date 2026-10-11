"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Dict, Locale } from "@/i18n";
import { fill } from "@/i18n";
import type { ChatItem } from "@/lib/chat";
import { money, moneyRange, sessionTime } from "@/lib/format";

type T = Dict["chat"];

/**
 * The conversation: the pinned request card at the top, then the messages in
 * order, the artist's reservation offers as cards, and the composer. It asks
 * the server for news every few seconds while the page is in view.
 */
export function Thread({
  items,
  side,
  names,
  t,
  locale,
  pinned,
  onSend,
  locked = false,
  notice,
  waiting,
  tools,
}: {
  items: ChatItem[];
  /** Whose screen this is: their own messages sit on the right. */
  side: "client" | "artist";
  names: { client: string; artist: string };
  t: T;
  locale: Locale;
  pinned: React.ReactNode;
  onSend: (text: string) => Promise<{ error?: string } | void>;
  locked?: boolean;
  /** The house's note right after the request opens the conversation. */
  notice?: string;
  /** Set while the composer waits for the other side to answer first. */
  waiting?: string | null;
  /** Extra controls under the composer (the artist's "offer a date"). */
  tools?: React.ReactNode;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const count = items.length;

  // News from the other side: refresh while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router]);

  // Each new message brings the bottom into view (not the first render: the page opens at the top).
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    seen.current = count;
  }, [count]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const res = await onSend(body);
      if (res?.error) setError(res.error);
      else {
        setText("");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-4">
      {pinned}
      <ol className="grid gap-3" aria-label={t.conversation}>
        {items.map((m) => {
          if (m.kind === "created")
            return (
              <li key={m.id} className="grid gap-3">
                <p className="text-center text-[0.8rem] text-ash">
                  {fill(t.opened, { name: names.client, artist: names.artist })} · {stamp(m.at, locale)}
                </p>
                {notice && (
                  <p role="note" className="mx-auto max-w-md rounded-[16px] border border-gilt/50 bg-niche px-4 py-3 text-center text-[0.95rem] leading-snug text-vellum">
                    {notice}
                  </p>
                )}
              </li>
            );
          if (m.kind === "paid")
            return (
              <li key={m.id} className="mx-auto rounded-full border border-verdigris/50 px-4 py-1.5 text-center text-[0.85rem] text-verdigris">
                {t.booked} · {stamp(m.at, locale)}
              </li>
            );
          const mine = (m.actor === "client") === (side === "client");
          if (m.kind === "offer" && m.offer) return <Offer key={m.id} item={m} side={side} t={t} locale={locale} artist={names.artist} />;
          if (!m.body) return null;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[0.98rem] leading-snug whitespace-pre-line ${
                  mine ? "rounded-br-[6px] bg-vellum text-soot" : "rounded-bl-[6px] border border-line bg-niche text-vellum"
                } ${m.kind === "declined" ? "border-oxblood/60" : ""}`}
              >
                {m.body}
                <span className={`mt-1 block text-right text-[0.7rem] ${mine ? "text-soot/60" : "text-ash"}`}>{stamp(m.at, locale)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={end} />
      {locked ? null : waiting ? (
        <p className="sticky bottom-0 border-t border-line bg-soot/95 pt-3 pb-[max(env(safe-area-inset-bottom),0.9rem)] text-center text-[0.88rem] text-ash backdrop-blur">{waiting}</p>
      ) : (
        <form
          className="sticky bottom-0 grid gap-2 border-t border-line bg-soot/95 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {error && (
            <p role="alert" className="text-[0.85rem] text-oxblood">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="chat-input">
              {t.placeholder}
            </label>
            <textarea
              id="chat-input"
              className="input min-h-12 flex-1 resize-none"
              rows={1}
              value={text}
              maxLength={3000}
              placeholder={t.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="btn btn-primary shrink-0" disabled={pending || !text.trim()}>
              {t.send}
            </button>
          </div>
          {tools}
        </form>
      )}
    </div>
  );
}

function stamp(at: string, locale: Locale) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(locale, { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** A reservation offer: the date, the estimate, the first payment, and the way to take it. */
function Offer({ item, side, t, locale, artist }: { item: ChatItem; side: "client" | "artist"; t: T; locale: Locale; artist: string }) {
  const o = item.offer!;
  const when = o.starts_at && o.timezone ? sessionTime(new Date(o.starts_at), o.timezone, locale) : null;
  const open = o.status === "sent" || o.status === "viewed";
  const expired = open && o.expired;
  const state = o.status === "paid" ? t.offer.taken : o.status === "withdrawn" ? t.offer.replaced : expired ? t.offer.expired : null;
  return (
    <li className="mx-auto w-full max-w-md">
      <div className={`relative overflow-hidden rounded-[18px] border bg-niche p-4 ${open && !expired ? "border-gilt" : "border-line opacity-80"}`}>
        <p className="p-stamp text-[0.62rem] tracking-[0.2em] text-gilt uppercase">{fill(t.offer.kicker, { artist })}</p>
        {when && (
          <p className="mt-2 font-serif text-[1.5rem] leading-tight">
            {when.day}
            <span className="block text-[1.05rem] text-ash">
              {when.time}
              {o.city ? ` · ${o.studio_name ? `${o.studio_name}, ` : ""}${o.city}` : ""}
            </span>
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[0.9rem]">
          <div>
            <dt className="text-[0.75rem] text-ash">{t.offer.estimate}</dt>
            <dd className="t-num">{moneyRange(o.price_min_cents, o.price_max_cents, o.currency, locale)}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] text-ash">{t.offer.deposit}</dt>
            <dd className="t-num">{money(o.deposit_cents, o.currency, locale)}</dd>
          </div>
        </dl>
        {item.body && <p className="mt-3 text-[0.95rem] whitespace-pre-line text-vellum/90">{item.body}</p>}
        {state ? (
          <p className="mt-3 text-[0.85rem] text-ash">{state}</p>
        ) : side === "client" ? (
          <a href={`/q/${o.token}`} className="btn btn-primary mt-4 w-full">
            {t.offer.take}
          </a>
        ) : (
          <p className="mt-3 text-[0.85rem] text-ash">{t.offer.waiting}</p>
        )}
      </div>
    </li>
  );
}
