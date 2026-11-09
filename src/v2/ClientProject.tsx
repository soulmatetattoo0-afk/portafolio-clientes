"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { BodyChart, chartViews } from "@/components/chat/BodyChart";
import { fill, type Dict, type Locale } from "@/i18n";
import type { Balance } from "@/lib/balance";
import { colorLabel, styleLabel } from "@/lib/catalog";
import type { ChatCard, ChatItem } from "@/lib/chat";
import { cmLabel, money, sessionTime } from "@/lib/format";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

/**
 * The client's whole project on one sheet, opened from the bar pinned under
 * the artist's name: the idea and its pictures (theirs and the artist's),
 * what was agreed (date, place, length, total, the deposit and what it adds,
 * what is left for the day, the artist's notes), what was said in the chat,
 * and the cancelling rule. It follows the latest proposal: when the artist
 * edits it, this is the saved version.
 */
export function ClientProject({
  card,
  items,
  balance,
  artist,
  feeCents,
  reserveHref,
  letter,
  trigger,
  t,
  locale,
}: {
  card: ChatCard;
  items: ChatItem[];
  balance: Balance | null;
  artist: string;
  /** VANTA's service fee on the deposit, when the deposit is paid in the app. */
  feeCents: number | null;
  /** The open proposal's booking page. */
  reserveHref?: string;
  /** The original request, as its letter. */
  letter: React.ReactNode;
  trigger: React.ReactNode;
  t: Dict;
  locale: Locale;
}) {
  const p = t.chat.project;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const offers = items.filter((i) => i.kind === "offer" && i.offer);
  const current = [...offers].reverse().find((i) => i.offer!.status === "paid") ?? [...offers].reverse().find((i) => (i.offer!.status === "sent" || i.offer!.status === "viewed") && !i.offer!.expired);
  const o = current?.offer;
  const edited = Boolean(o) && offers.some((i) => i.offer!.status === "withdrawn");
  const when = o?.starts_at && o.timezone ? sessionTime(new Date(o.starts_at), o.timezone, locale) : null;
  const hours = o?.starts_at && o.ends_at ? Math.round(((new Date(o.ends_at).getTime() - new Date(o.starts_at).getTime()) / 3_600_000) * 2) / 2 : null;
  const fmt = (cents: number) => money(cents, o?.currency ?? card.currency, locale);
  const restCents = balance?.amountCents ?? (o ? Math.max(0, o.price_min_cents - o.deposit_cents) : null);
  const artistImages = items.filter((i) => i.image);
  const talk = items.filter((i) => i.kind === "message" && i.body && !i.care && !i.request && !i.image).slice(-6);
  const placement = PLACEMENT_BY_SLUG.get(card.placement)?.label[locale] ?? card.placement;
  const size = card.full_coverage ? t.studio.brief.fullCoverage : cmLabel(card.size_w_cm, card.size_h_cm);
  const status = balance?.paid ? p.statusPaid : balance && when ? fill(p.statusBooked, { date: `${when.day} · ${when.time}` }) : o ? p.statusOffer : null;
  const savedAt = current ? new Date(current.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left" aria-label={p.open}>
        {trigger}
      </button>
      {open &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={p.title} className="poster fixed inset-0 z-[80] overflow-y-auto bg-ink text-bone">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-bone/[0.07] bg-ink/92 px-3 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2 backdrop-blur">
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center" aria-label={p.close}>
                <span aria-hidden className="text-[1.4rem]">←</span>
              </button>
              <p className="p-display min-w-0 flex-1 truncate text-[1.5rem] uppercase leading-none">{p.title}</p>
              <span className="p-stamp text-bone/60">Nº {card.ref}</span>
            </div>

            <div className="mx-auto grid w-full max-w-2xl gap-5 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
              {/* Saved: the house's tag on the current version. */}
              {o && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e8c46b]/50 bg-[#e8c46b]/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#f2d27a]">
                    <span aria-hidden>📌</span> {p.saved}
                  </span>
                  {edited && <span className="rounded-full bg-accent px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-bone">{p.edited}</span>}
                  {savedAt && <span className="text-[0.75rem] text-bone/55">{fill(p.savedAt, { time: savedAt })}</span>}
                </div>
              )}

              {/* The idea, on the request's paper. */}
              <section className="relative overflow-hidden rounded-[22px] bg-[#ece4d4] p-5 text-[#2b2420]">
                <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
                <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="min-w-0">
                    <p className="p-stamp text-[#2b2420]/60">{styleLabel(card.style, locale)} · {colorLabel(card.color_mode, locale)}</p>
                    <p className="p-display mt-1 text-[2rem] leading-[0.9] uppercase">{placement}</p>
                    <p className="p-stamp mt-1 text-[#2b2420]/70">{[size, card.city].filter(Boolean).join(" · ")}</p>
                  </div>
                  <BodyChart placement={card.placement} body={card.body} views={chartViews(card.placement).length ? chartViews(card.placement) : ["front"]} className="w-[3.4rem] gap-1" />
                </div>
                <p className="p-stamp relative mt-5 text-[#2b2420]/60">{p.idea}</p>
                <p className="relative mt-1.5 font-[family-name:var(--font-cormorant)] text-[1.25rem] leading-snug whitespace-pre-line italic">{card.description}</p>
                {card.avoid && <p className="relative mt-3 border-l-2 pl-3 text-[0.92rem] text-[#2b2420]/80" style={{ borderColor: "var(--accent)" }}>{card.avoid}</p>}
              </section>

              {/* The pictures: the client's references and what the artist sent. */}
              {(card.files.length > 0 || artistImages.length > 0) && (
                <section>
                  <h2 className="p-stamp text-bone/60">{p.images}</h2>
                  <div className="mt-3 grid gap-4">
                    {card.files.length > 0 && <Strip label={p.yours} urls={card.files.map((f) => f.url)} />}
                    {artistImages.length > 0 && <Strip label={fill(p.byArtist, { artist })} urls={artistImages.map((i) => i.image!)} />}
                  </div>
                </section>
              )}

              {/* What was agreed, set like a ticket. */}
              <section className="v2-sheet relative overflow-hidden rounded-[22px] border border-bone/10 bg-[#24201d] p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="p-display text-[1.6rem] uppercase leading-none">{p.agreed}</h2>
                  {status && <span className="truncate text-[0.78rem] text-[#c3dcae]">{status}</span>}
                </div>
                {o ? (
                  <>
                    <dl className="mt-4 grid gap-2.5 text-[0.95rem]">
                      {when && <Line label={p.date}>{when.day} · {when.time}</Line>}
                      {(o.city || o.studio_name) && <Line label={p.place}>{[o.studio_name, o.city].filter(Boolean).join(", ")}</Line>}
                      {hours && <Line label={p.length}>{fill(p.hoursValue, { h: String(hours) })}</Line>}
                      <Line label={p.total} strong>{fmt(o.price_min_cents)}</Line>
                    </dl>
                    <div className="mt-4 grid gap-2 rounded-[16px] border border-bone/10 bg-ink/40 p-4 text-[0.92rem]">
                      <Line label={balance ? p.paidDeposit : p.deposit}>{fmt(o.deposit_cents)}</Line>
                      {feeCents !== null && feeCents > 0 && <Line label={p.fee}>{fmt(feeCents)}</Line>}
                      {feeCents !== null && feeCents > 0 && !balance && <Line label={p.today} strong>{fmt(o.deposit_cents + feeCents)}</Line>}
                      {restCents !== null && <Line label={balance?.paid ? p.paidRest : p.rest}>{fmt(restCents)}</Line>}
                    </div>
                    {current?.body && (
                      <div className="mt-4">
                        <p className="p-stamp text-bone/60">{p.notes}</p>
                        <p className="mt-1.5 text-[0.95rem] leading-relaxed whitespace-pre-line text-bone/85">{current.body}</p>
                      </div>
                    )}
                    {reserveHref && !balance && (
                      <a href={reserveHref} className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-4 text-center text-[0.95rem] font-semibold text-bone shadow-[0_10px_20px_-10px_rgb(0_0_0/0.8)]">
                        {fill(t.chat.offer.take, { artist })}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-[0.92rem] text-bone/70">{fill(p.none, { artist })}</p>
                )}
              </section>

              {/* What was said, in short. */}
              {talk.length > 0 && (
                <section>
                  <h2 className="p-stamp text-bone/60">{p.talk}</h2>
                  <ol className="mt-3 grid gap-2">
                    {talk.map((m) => (
                      <li key={m.id} className={`rounded-[16px] px-4 py-2.5 text-[0.9rem] leading-snug ${m.actor === "client" ? "ml-8 bg-[#e7dece] text-[#221d19]" : "mr-8 border border-bone/[0.07] bg-[#2b2622] text-bone/90"}`}>
                        <span className="line-clamp-4 whitespace-pre-line">{m.body}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="rounded-[16px] border border-bone/10 px-4 py-3">
                <p className="p-stamp text-bone/60">{p.policy}</p>
                <p className="mt-1.5 text-[0.88rem] leading-snug text-bone/75">{p.policyText}</p>
              </section>

              <div className="grid gap-2">
                <p className="p-stamp text-bone/60">{p.letter}</p>
                {letter}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="v2-btn" data-tone="ghost">
                {p.close}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Line({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-bone/60">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-bone/20" />
      <dd className={`text-right tabular-nums ${strong ? "p-display text-[1.35rem] leading-none" : ""}`}>{children}</dd>
    </div>
  );
}

function Strip({ label, urls }: { label: string; urls: string[] }) {
  return (
    <div>
      <p className="text-[0.78rem] text-bone/55">{label}</p>
      <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {urls.map((u, i) => (
          <li key={`${u}-${i}`} className="shrink-0" style={{ rotate: `${[-1.5, 1, -1, 1.5][i % 4]}deg` }}>
            <a href={u} target="_blank" rel="noreferrer" className="block aspect-[4/5] w-28 overflow-hidden rounded-[10px] bg-[#2b2622]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
