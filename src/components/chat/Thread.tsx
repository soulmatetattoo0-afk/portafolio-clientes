"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Dict, Locale } from "@/i18n";
import { fill } from "@/i18n";
import type { ChatItem } from "@/lib/chat";

import { CareLetter } from "./CareLetter";
import { PickDays } from "./PickDays";
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
  chatToken,
  afterPinned,
  project,
  careLabels,
  linkSuffix = "",
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
  /** The client's private key to this conversation, for picking a day in a calendar offer. */
  chatToken?: string;
  /** Under the pinned letter: the artist's accept / decline while the request is new. */
  afterPinned?: React.ReactNode;
  /** The request in one line, attached to each booking confirmation; a tap opens the whole project. */
  project?: React.ReactNode;
  /** The words on the care letters. */
  careLabels?: { download: string; from: string };
  /** Appended to the booking link (the artist walking the client's side keeps their own bar). */
  linkSuffix?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  // What this side just wrote, shown at once; dropped once the server's copy is in the list.
  const [sent, setSent] = useState<{ id: string; body: string; at: string }[]>([]);
  const mine = side === "client" ? "client" : "artist";
  const shown = sent.filter((s) => !items.some((m) => m.actor === mine && m.kind === "message" && m.body === s.body));
  const count = items.length + shown.length;

  // News from the other side: refresh when the tab comes back into view.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
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
    const local = { id: `local-${Date.now()}`, body, at: new Date().toISOString() };
    setSent((l) => [...l, local]);
    setText("");
    start(async () => {
      const res = await onSend(body);
      if (res?.error) {
        setError(res.error);
        setSent((l) => l.filter((s) => s.id !== local.id));
        setText(body);
      } else router.refresh();
    });
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label={t.conversation}>
        {items.map((m) => {
          if (m.kind === "created")
            // The request opens the conversation as the client's first message: the letter, sealed by VANTA.
            return (
              <li key={m.id} className="grid gap-3">
                <div className={`flex ${side === "client" ? "justify-end" : "justify-start"}`}>
                  <div className="w-[min(86%,340px)]">
                    {pinned}
                    <span className={`mt-1 block text-[0.7rem] text-ash ${side === "client" ? "text-right" : ""}`}>{stamp(m.at, locale)}</span>
                  </div>
                </div>
                {afterPinned && <div className="w-[min(86%,340px)]">{afterPinned}</div>}
                {notice && (
                  <p role="note" className="mx-auto max-w-md rounded-[16px] border border-gilt/50 bg-niche px-4 py-3 text-center text-[0.95rem] leading-snug text-vellum">
                    {notice}
                  </p>
                )}
              </li>
            );
          if (m.kind === "balance")
            return (
              <li key={m.id} className="mx-auto rounded-full border border-verdigris/50 px-4 py-1.5 text-center text-[0.85rem] text-verdigris">
                {fill(side === "artist" ? t.balance.paidArtist : t.balance.paid, { amount: m.amount ? money(m.amount.cents, m.amount.currency, locale) : "" })} · {stamp(m.at, locale)}
              </li>
            );
          if (m.kind === "paid")
            return (
              <li key={m.id} className="mx-auto rounded-full border border-verdigris/50 px-4 py-1.5 text-center text-[0.85rem] text-verdigris">
                {t.booked} · {stamp(m.at, locale)}
              </li>
            );
          const mine = (m.actor === "client") === (side === "client");
          if (m.kind === "offer" && m.offer) return <Offer key={m.id} item={m} side={side} t={t} locale={locale} artist={names.artist} chatToken={chatToken} project={project} linkSuffix={linkSuffix} />;
          if (!m.body) return null;
          if (m.care && careLabels) return <CareLetter key={m.id} stage={m.care} body={m.body} artist={names.artist} labels={careLabels} mine={side === "artist"} />;
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
        {shown.map((s) => (
          <li key={s.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-[18px] rounded-br-[6px] bg-vellum px-4 py-2.5 text-[0.98rem] leading-snug whitespace-pre-line text-soot opacity-80">
              {s.body}
              <span className="mt-1 block text-right text-[0.7rem] text-soot/60">{stamp(s.at, locale)}</span>
            </div>
          </li>
        ))}
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

/** The artist's booking confirmation: a letter with the agreed date, the estimate, the deposit, the project attached, and the way to take it. */
function Offer({ item, side, t, locale, artist, chatToken, project, linkSuffix = "" }: { item: ChatItem; side: "client" | "artist"; t: T; locale: Locale; artist: string; chatToken?: string; project?: React.ReactNode; linkSuffix?: string }) {
  const o = item.offer!;
  const when = o.starts_at && o.timezone ? sessionTime(new Date(o.starts_at), o.timezone, locale) : null;
  const open = o.status === "sent" || o.status === "viewed";
  const expired = open && o.expired;
  const state = o.status === "paid" ? t.offer.taken : o.status === "withdrawn" ? t.offer.replaced : expired ? t.offer.expired : null;
  const picking = Boolean(o.pick) && open && !expired;
  return (
    <li className={`flex ${side === "artist" ? "justify-end" : "justify-start"}`}>
      <div className={`relative w-[min(92%,400px)] overflow-hidden rounded-[18px] border bg-niche p-4 ${open && !expired ? "border-gilt" : "border-line opacity-80"}`}>
        <p className="p-display text-[1.5rem] leading-none">{o.calendar && !when ? fill(t.offer.pickKicker, { artist }) : t.offer.letter}</p>
        <p className="mt-1 p-stamp text-[0.62rem] tracking-[0.2em] text-gilt uppercase">{fill(o.calendar && !when ? t.offer.pickKicker : t.offer.kicker, { artist })}</p>
        {o.pick && !when && (
          <p className="mt-2 font-serif text-[1.2rem] leading-snug">{fill(t.offer.pickLead, { time: o.pick.time, hours: String(o.pick.hours) })}</p>
        )}
        {when && (
          <p className="mt-2 font-serif text-[1.5rem] leading-tight">
            {when.day}
            <span className="block text-[1.05rem] text-ash">
              {when.time}
              {o.city ? ` · ${o.studio_name ? `${o.studio_name}, ` : ""}${o.city}` : ""}
            </span>
          </p>
        )}
        {when && !o.pick && (
          <p className="mt-3 text-[0.95rem] leading-snug text-vellum/90">{fill(t.offer.evaluated, { total: moneyRange(o.price_min_cents, o.price_max_cents, o.currency, locale), deposit: money(o.deposit_cents, o.currency, locale) })}</p>
        )}
        {!state && !picking && side === "client" && (
          <a href={`/q/${o.token}${linkSuffix}`} className="btn btn-primary mt-4 h-auto min-h-12 w-full whitespace-normal px-4 py-3 text-center leading-tight">
            {fill(t.offer.take, { artist })}
          </a>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[0.9rem]">
          <div>
            <dt className="text-[0.75rem] text-ash">{t.offer.deposit}</dt>
            <dd className="t-num text-[1.1rem]">{money(o.deposit_cents, o.currency, locale)}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] text-ash">{t.offer.balanceDue}</dt>
            <dd className="t-num text-[1.1rem]">{o.price_max_cents && o.price_max_cents !== o.price_min_cents ? moneyRange(o.price_min_cents - o.deposit_cents, o.price_max_cents - o.deposit_cents, o.currency, locale) : money(Math.max(0, o.price_min_cents - o.deposit_cents), o.currency, locale)}</dd>
          </div>
        </dl>
        {item.body && <p className="mt-3 text-[0.95rem] whitespace-pre-line text-vellum/90">{item.body}</p>}
        {project && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-1.5 text-[0.75rem] text-ash">{t.offer.project}</p>
            {project}
          </div>
        )}
        {state ? (
          <p className="mt-3 text-[0.85rem] text-ash">{state}</p>
        ) : picking && o.pick ? (
          side === "client" && chatToken ? (
            <PickDays chatToken={chatToken} token={o.token} pick={o.pick} locale={locale} t={t.offer} />
          ) : (
            <p className="mt-3 text-[0.85rem] text-ash">{t.offer.pickWaiting}</p>
          )
        ) : side === "client" ? null : (
          <p className="mt-3 text-[0.85rem] text-ash">{o.calendar && when ? fill(t.offer.pickChosen, { date: when.day }) : t.offer.waiting}</p>
        )}
      </div>
    </li>
  );
}
