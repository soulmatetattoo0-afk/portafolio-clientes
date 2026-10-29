"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Dict, Locale } from "@/i18n";
import { fill } from "@/i18n";
import type { ChatItem } from "@/lib/chat";

import { VantaMark } from "@/components/brand/VantaLogo";

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
  pulse,
}: {
  /** Where to ask, every few seconds while the chat is in view, whether anything new happened. */
  pulse?: string;
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

  // While the chat is in view, check every few seconds for news from the other side; reload only when there is some.
  useEffect(() => {
    if (!pulse) return;
    let known: string | null = null;
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(pulse, { cache: "no-store" });
        if (!r.ok) return;
        const { v } = (await r.json()) as { v: string };
        if (!alive) return;
        if (known !== null && v !== known) router.refresh();
        known = v;
      } catch {
        /* offline for a moment: the next tick tries again */
      }
    };
    void check();
    const id = setInterval(check, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pulse, router]);

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

  // Each message knows its neighbours: bubbles from one side run together, the tail and the time sit on the last.
  const isText = (m: ChatItem | undefined) => Boolean(m && m.kind !== "offer" && m.kind !== "created" && m.kind !== "paid" && m.kind !== "balance" && m.body && !m.care);
  const dayOf = (at: string) => new Date(at).toDateString();
  const other = side === "client" ? names.artist : names.client;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5" aria-label={t.conversation}>
        {items.map((m, i) => {
          const prev = items[i - 1];
          const next = items[i + 1];
          const newDay = !prev || dayOf(prev.at) !== dayOf(m.at);
          const divider = newDay ? <DayLine key={`d-${m.id}`} at={m.at} t={t} locale={locale} /> : null;
          if (m.kind === "created")
            // The request opens the conversation as the client's first message: the letter, sealed by VANTA.
            return [
              divider,
              <li key={m.id} className="grid gap-3 pb-2">
                <div className={`flex ${side === "client" ? "justify-end" : "justify-start"}`}>
                  <div className="w-[min(90%,360px)]">
                    {pinned}
                    <span className={`mt-1.5 block text-[0.7rem] text-bone/45 ${side === "client" ? "text-right" : ""}`}>{stamp(m.at, locale)}</span>
                  </div>
                </div>
                {afterPinned && <div className="w-[min(90%,360px)]">{afterPinned}</div>}
                {notice && (
                  <p role="note" className="mx-auto max-w-md rounded-[16px] border border-bone/12 bg-[#2a2522] px-4 py-3 text-center text-[0.95rem] leading-snug text-bone">
                    {notice}
                  </p>
                )}
              </li>,
            ];
          if (m.kind === "paid")
            // The booking, stamped in the middle of the conversation for both sides.
            return [
              divider,
              <li key={m.id} className="my-3 flex justify-center">
                <div className="w-[min(92%,360px)] rounded-[16px] border-[3px] border-double border-[#8fb07a]/80 bg-[#8fb07a]/10 px-4 py-3 text-center">
                  <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-bone/45"><VantaMark className="h-2.5 w-auto" /> VANTA</p>
                  <p className="p-display flex items-center justify-center gap-2 text-[1.45rem] uppercase leading-none tracking-[0.02em] text-[#c3dcae]">
                    <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-[#8fb07a] font-sans text-[0.8rem] font-bold text-[#14120f]">
                      ✓
                    </span>
                    {t.bookedBanner}
                  </p>
                  <p className="mt-1.5 text-[0.82rem] leading-snug text-bone/70">
                    {fill(t.bookedLine, { artist: names.artist })}
                    {m.amount && m.amount.cents > 0 ? ` · ${fill(t.bookedDeposit, { amount: money(m.amount.cents, m.amount.currency, locale) })}` : ""}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-bone/40">{time(m.at, locale)}</p>
                </div>
              </li>,
            ];
          if (m.kind === "balance")
            // The session paid in full: the loudest line in the chat, in gold.
            return [
              divider,
              <li key={m.id} className="my-3 flex justify-center">
                <div className="w-[min(92%,360px)] rounded-[16px] border-[3px] border-double border-[#e8c46b] bg-[#e8c46b]/10 px-4 py-3.5 text-center shadow-[0_0_40px_-12px_rgb(232_196_107/0.55)]">
                  <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-bone/45"><VantaMark className="h-2.5 w-auto" /> VANTA</p>
                  <p className="p-display text-[1.5rem] uppercase leading-none tracking-[0.02em] text-[#f2d27a]">{t.balance.banner}</p>
                  {m.amount && <p className="mt-1.5 font-[family-name:var(--font-cinzel)] text-[1.6rem] font-bold text-[#f2d27a] tabular-nums">{money(m.amount.cents, m.amount.currency, locale)}</p>}
                  <p className="mt-1 text-[0.82rem] leading-snug text-bone/70">{side === "artist" ? t.balance.bannerArtist : fill(t.balance.bannerClient, { artist: names.artist })}</p>
                  <p className="mt-1 text-[0.7rem] text-bone/40">{time(m.at, locale)}</p>
                </div>
              </li>,
            ];
          if (m.request)
            // The client asked to book (paid straight to the artist): a notice, not a question.
            return [
              divider,
              <li key={m.id} className="my-3 flex justify-center">
                <div className="w-[min(92%,360px)] rounded-[16px] border border-[#e8c46b]/45 bg-[#e8c46b]/[0.07] px-4 py-3 text-center">
                  <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-bone/45"><VantaMark className="h-2.5 w-auto" /> VANTA</p>
                  <p className="p-display text-[1.2rem] uppercase leading-none text-[#f2d27a]">{t.direct.requestedTitle}</p>
                  <p className="mt-1.5 text-[0.84rem] leading-snug text-bone/75">
                    {fill(side === "artist" ? t.direct.requestedArtist : t.direct.requestedClient, { name: names.client.split(" ")[0], artist: names.artist, amount: m.amount ? money(m.amount.cents, m.amount.currency, locale) : "" })}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-bone/40">{time(m.at, locale)}</p>
                </div>
              </li>,
            ];
          const mine = (m.actor === "client") === (side === "client");
          if (m.kind === "offer" && m.offer) return [divider, <Offer key={m.id} item={m} side={side} t={t} locale={locale} artist={names.artist} chatToken={chatToken} project={project} linkSuffix={linkSuffix} />];
          if (!m.body) return divider;
          if (m.care && careLabels) return [divider, <CareLetter key={m.id} stage={m.care} body={m.body} artist={names.artist} labels={careLabels} mine={side === "artist"} />];
          const sameAsPrev = !newDay && isText(prev) && prev!.actor === m.actor;
          const last = !(isText(next) && next!.actor === m.actor && dayOf(next!.at) === dayOf(m.at));
          return [
            divider,
            <li key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${sameAsPrev ? "" : "mt-2"}`}>
              {!mine && <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#3a332e] text-[0.72rem] font-semibold text-bone ${last ? "" : "invisible"}`} aria-hidden>{other[0]}</span>}
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`px-4 py-2.5 text-[0.98rem] leading-snug whitespace-pre-line ${
                    mine
                      ? `rounded-[20px] bg-[linear-gradient(180deg,#f4ede0,#e7dece)] text-[#221d19] shadow-[0_8px_18px_-12px_rgb(0_0_0/0.9)] ${last ? "rounded-br-[6px]" : ""}`
                      : `rounded-[20px] border border-bone/[0.07] bg-[#2b2622] text-bone shadow-[0_8px_18px_-12px_rgb(0_0_0/0.9)] ${last ? "rounded-bl-[6px]" : ""}`
                  } ${m.kind === "declined" ? "ring-1 ring-accent/60" : ""}`}
                >
                  {m.body}
                </div>
                {last && <span className="mt-1 px-1 text-[0.68rem] text-bone/40">{time(m.at, locale)}</span>}
              </div>
            </li>,
          ];
        })}
        {shown.map((s) => (
          <li key={s.id} className="mt-2 flex justify-end">
            <div className="flex max-w-[80%] flex-col items-end">
              <div className="rounded-[20px] rounded-br-[6px] bg-[linear-gradient(180deg,#f4ede0,#e7dece)] px-4 py-2.5 text-[0.98rem] leading-snug whitespace-pre-line text-[#221d19] opacity-75">{s.body}</div>
              <span className="mt-1 px-1 text-[0.68rem] text-bone/40">{time(s.at, locale)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div ref={end} />
      {locked ? null : waiting ? (
        <p className="v2-composer sticky z-20 mx-auto mb-2 w-full max-w-md rounded-[18px] shadow-[0_-12px_30px_8px_#171412] border border-bone/10 bg-[#24201d]/95 px-4 py-3 text-center text-[0.88rem] leading-snug text-bone/70 backdrop-blur">{waiting}</p>
      ) : (
        <form
          className="v2-composer v2-composer-fade sticky z-20 -mx-4 grid gap-2 px-4 pt-7 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {error && (
            <p role="alert" className="px-2 text-[0.85rem] text-accent">
              {error}
            </p>
          )}
          <div className="flex items-end gap-1.5 rounded-[26px] border border-bone/12 bg-[#26221f]/95 p-1.5 pl-4 shadow-[0_18px_36px_-18px_rgb(0_0_0/0.9)] backdrop-blur">
            <label className="sr-only" htmlFor="chat-input">
              {t.placeholder}
            </label>
            <textarea
              id="chat-input"
              className="field-sizing-content max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-[0.98rem] leading-snug text-bone placeholder:text-bone/40 focus:outline-none"
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
            <button type="submit" aria-label={t.send} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-bone transition-transform active:scale-90 disabled:bg-bone/10 disabled:text-bone/35" disabled={pending || !text.trim()}>
              <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" />
              </svg>
            </button>
          </div>
          {tools}
        </form>
      )}
    </div>
  );
}

/** The day between messages: today, yesterday, or the date. */
function DayLine({ at, t, locale }: { at: string; t: T; locale: Locale }) {
  const d = new Date(at);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const label = d.toDateString() === now.toDateString() ? t.today : d.toDateString() === yesterday.toDateString() ? t.yesterday : d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  return (
    <li className="my-3 flex items-center gap-3 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-bone/40" aria-hidden>
      <span className="h-px flex-1 bg-bone/10" />
      {label}
      <span className="h-px flex-1 bg-bone/10" />
    </li>
  );
}

function time(at: string, locale: Locale) {
  return new Date(at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

function stamp(at: string, locale: Locale) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(locale, { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** The artist's booking confirmation: a ticket on the same paper as the request, with the date, the estimate, the deposit stub, the project attached and the way to take it. */
function Offer({ item, side, t, locale, artist, chatToken, project, linkSuffix = "" }: { item: ChatItem; side: "client" | "artist"; t: T; locale: Locale; artist: string; chatToken?: string; project?: React.ReactNode; linkSuffix?: string }) {
  const o = item.offer!;
  const when = o.starts_at && o.timezone ? sessionTime(new Date(o.starts_at), o.timezone, locale) : null;
  const open = o.status === "sent" || o.status === "viewed";
  const expired = open && o.expired;
  const state = o.status === "paid" ? t.offer.taken : o.status === "withdrawn" ? t.offer.replaced : expired ? t.offer.expired : null;
  const picking = Boolean(o.pick) && open && !expired;
  const balance = o.price_max_cents && o.price_max_cents !== o.price_min_cents ? moneyRange(o.price_min_cents - o.deposit_cents, o.price_max_cents - o.deposit_cents, o.currency, locale) : money(Math.max(0, o.price_min_cents - o.deposit_cents), o.currency, locale);
  return (
    <li className={`my-2 flex ${side === "artist" ? "justify-end" : "justify-start"}`}>
      <div className={`relative w-[min(92%,380px)] overflow-hidden rounded-[6px] bg-[#f3ecdf] text-[#2b2420] shadow-[0_26px_44px_-20px_rgb(0_0_0/0.85)] ${o.status === "withdrawn" || expired ? "opacity-70" : ""}`}>
        <span className="p-grain" aria-hidden style={{ opacity: 0.35 }} />
        <span aria-hidden className="absolute inset-x-5 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
        {o.status === "paid" && (
          // Paid: the house stamps it.
          <span aria-hidden className="absolute top-[8.4rem] right-4 z-10 -rotate-12 rounded-[6px] border-[2.5px] border-double border-[#557a43] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#557a43] opacity-90 mix-blend-multiply">
            {t.booked}
          </span>
        )}
        <div className="relative px-5 pt-5">
          <p className="text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-[#2b2420]/60">{fill(o.calendar && !when ? t.offer.pickKicker : t.offer.kicker, { artist })}</p>
          <p className="mt-2 font-[family-name:var(--font-cinzel)] text-[1.3rem] leading-[1.05] font-bold uppercase">{t.offer.letter}</p>
          <span aria-hidden className="mt-2.5 block h-px w-10" style={{ background: "var(--accent)" }} />
          {o.pick && !when && <p className="mt-3 font-[family-name:var(--font-cormorant)] text-[1.2rem] leading-snug italic">{fill(t.offer.pickLead, { time: o.pick.time, hours: String(o.pick.hours) })}</p>}
          {when && (
            <p className="mt-3 font-[family-name:var(--font-cormorant)] text-[1.55rem] leading-[1.1] italic first-letter:uppercase">
              {when.day}
              <span className="mt-0.5 block font-sans text-[0.85rem] not-italic text-[#2b2420]/70">
                {when.time}
                {o.city ? ` · ${o.studio_name ? `${o.studio_name}, ` : ""}${o.city}` : ""}
              </span>
            </p>
          )}
          {when && !o.pick && <p className="mt-3 text-[0.9rem] leading-snug text-[#2b2420]/85">{fill(t.offer.evaluated, { total: moneyRange(o.price_min_cents, o.price_max_cents, o.currency, locale), deposit: money(o.deposit_cents, o.currency, locale) })}</p>}
          {item.body && <p className="mt-3 text-[0.9rem] leading-snug whitespace-pre-line text-[#2b2420]/85">{item.body}</p>}
        </div>
        {/* The stub: torn along the dotted line, what is paid now and what is left for the day. */}
        <div className="relative mt-4">
          <span aria-hidden className="absolute top-0 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#191614]" />
          <span aria-hidden className="absolute top-0 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#191614]" />
          <span aria-hidden className="mx-5 block border-t-[1.5px] border-dashed border-[#2b2420]/30" />
          <dl className="grid grid-cols-2 gap-3 px-5 pt-3">
            <div>
              <dt className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-[#2b2420]/60">{t.offer.deposit}</dt>
              <dd className="mt-0.5 font-[family-name:var(--font-cinzel)] text-[1.35rem] font-bold tabular-nums">{money(o.deposit_cents, o.currency, locale)}</dd>
            </div>
            <div>
              <dt className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-[#2b2420]/60">{t.offer.balanceDue}</dt>
              <dd className="mt-0.5 font-[family-name:var(--font-cinzel)] text-[1.35rem] font-bold tabular-nums">{balance}</dd>
            </div>
          </dl>
        </div>
        <div className="relative px-5 pt-3 pb-5">
          {project && (
            <div>
              <p className="mb-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-[#2b2420]/60">{t.offer.project}</p>
              {project}
            </div>
          )}
          {!state && !picking && side === "client" && (
            <a href={`/q/${o.token}${linkSuffix}`} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full px-4 py-3 text-center text-[0.95rem] leading-tight font-semibold text-white shadow-[0_10px_20px_-10px_rgb(0_0_0/0.6)]" style={{ background: "var(--accent)" }}>
              {fill(t.offer.take, { artist })}
            </a>
          )}
          {state ? (
            <p className="mt-3 text-[0.82rem] text-[#2b2420]/65">{state}</p>
          ) : picking && o.pick ? (
            side === "client" && chatToken ? (
              <div className="mt-3 rounded-[14px] bg-[#1d1a17] p-3 text-bone">
                <PickDays chatToken={chatToken} token={o.token} pick={o.pick} locale={locale} t={t.offer} />
              </div>
            ) : (
              <p className="mt-3 text-[0.82rem] text-[#2b2420]/65">{t.offer.pickWaiting}</p>
            )
          ) : side === "client" ? null : (
            <p className="mt-3 text-[0.82rem] text-[#2b2420]/65">{o.calendar && when ? fill(t.offer.pickChosen, { date: when.day }) : t.offer.waiting}</p>
          )}
        </div>
      </div>
    </li>
  );
}
