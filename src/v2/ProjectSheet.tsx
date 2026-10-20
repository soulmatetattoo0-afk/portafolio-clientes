"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { confirmDirectDeposit, confirmQuote, finishTattoo, markBalancePaid } from "@/app/studio/_legacy/actions";
import { fill, type Dict, type Locale } from "@/i18n";
import type { Balance } from "@/lib/balance";
import { styleLabel } from "@/lib/catalog";
import type { ChatCard } from "@/lib/chat";
import { money } from "@/lib/format";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { ConfirmForm, type QuoteStage } from "./QuoteActions";


/**
 * "Ver proyecto", at the top of the artist's chat: the whole project on one
 * sheet. The idea and the references, the booking already paid and what is
 * left, and, once the session is done, the one button that sends the client
 * the link for the rest. In the demo, a way to open the client's chat and pay.
 */
export function ProjectSheet({ briefId, card, balance, stage, bookedOn, chatToken, demo, direct = false, stops, defaults, t, locale }: { direct?: boolean; briefId: string; card: ChatCard; balance: Balance | null; stage: QuoteStage; bookedOn: string | null; chatToken: string; demo: boolean; stops: { id: string; label: string }[]; defaults: { deposit: number | null; hours: number | null; start: string | null; date?: string | null; stopId?: string | null; client?: string }; t: Dict; locale: Locale }) {
  const c = t.v2.chats;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
  const placement = PLACEMENT_BY_SLUG.get(card.placement)?.label[locale] ?? card.placement;
  const fmt = (cents: number) => money(cents, balance?.currency ?? card.currency, locale);
  const remaining = balance?.amountCents ?? null;
  const total = balance && remaining !== null ? remaining + balance.depositCents : null;
  const collect = () =>
    start(async () => {
      setError(null);
      const r = await finishTattoo(briefId);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-bone/30 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-bone">
        {c.project}
      </button>
      {open &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={c.projectTitle} className="poster studio fixed inset-0 z-[80] overflow-y-auto bg-ink text-bone">
            <div className="sticky top-0 z-10 flex items-center gap-3 bg-ink/90 px-3 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2 backdrop-blur">
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center" aria-label={t.common.close}>
                <span aria-hidden className="text-[1.4rem]">←</span>
              </button>
              <p className="p-display flex-1 truncate text-[1.5rem] uppercase leading-none">{c.projectTitle}</p>
              <span className="p-stamp text-bone/60">{card.ref}</span>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-bone/25 text-[1.2rem]" aria-label={t.common.close}>
                ×
              </button>
            </div>
            <div className="mx-auto grid w-full max-w-2xl gap-5 px-4 pt-3 pb-[calc(var(--v2-bar)+1rem)]">
              {/* The paper: the request as the client wrote it. */}
              <section className="relative overflow-hidden rounded-[22px] bg-[#ece4d4] p-5 text-[#2b2420]">
                <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
                <div className="relative">
                  <p className="p-stamp text-[#2b2420]/60">{styleLabel(card.style, locale)}</p>
                  <p className="p-display mt-1 text-[2rem] leading-[0.9] uppercase">{placement}</p>
                  <p className="p-stamp mt-1 text-[#2b2420]/70">
                    {[card.city, card.size_w_cm ? `${card.size_w_cm} × ${card.size_h_cm} cm` : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="p-quote mt-4 text-[1.2rem] text-[#2b2420]/90 whitespace-pre-line">{card.description}</p>
                  {card.avoid && <p className="mt-3 border-l-2 border-[#b0201a]/60 pl-3 text-[0.95rem] text-[#2b2420]/80">{card.avoid}</p>}
                  {card.files.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-3">
                      {card.files.map((f, i) => (
                        <li key={f.id} style={{ rotate: `${[-2, 1, -1, 2][i % 4]}deg` }}>
                          <a href={f.url} target="_blank" rel="noreferrer" className="block aspect-[4/5] w-[26vw] max-w-[120px] overflow-hidden rounded-[10px] bg-[#d9d0bf]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" style={{ mixBlendMode: "multiply", filter: "saturate(0.9) contrast(1.05)" }} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* The money: booking paid, what is left, and the button that collects it. */}
              {balance ? (
                <section className="v2-sheet p-4">
                  {bookedOn && (
                    <p className="p-stamp text-bone/60">
                      {c.session} · {bookedOn}
                    </p>
                  )}
                  <dl className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="p-stamp text-bone/60">{c.depositPaid}</dt>
                      <dd className="p-display mt-0.5 text-[1.8rem] leading-none text-[var(--color-olive,#6f8f5c)]">{fmt(balance.depositCents)}</dd>
                    </div>
                    <div>
                      <dt className="p-stamp text-bone/60">{c.remaining}</dt>
                      <dd className={`p-display mt-0.5 text-[1.8rem] leading-none ${balance.paid ? "text-[var(--color-olive,#6f8f5c)]" : "text-accent"}`}>{remaining !== null ? fmt(remaining) : "—"}</dd>
                    </div>
                  </dl>
                  {total !== null && (
                    <p className="mt-2 text-[0.8rem] text-bone-dim">
                      {c.totalLabel}: {fmt(total)}
                    </p>
                  )}
                  <div className="mt-4 grid gap-2">
                    {balance.paid ? (
                      <p className="rounded-full border border-[var(--color-olive,#6f8f5c)]/60 px-4 py-2 text-center text-[0.88rem] text-[var(--color-olive,#6f8f5c)]">{fill(c.collected, { amount: remaining !== null ? fmt(remaining) : "" })}</p>
                    ) : balance.requested ? (
                      direct ? (
                        <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={() => start(async () => (await markBalancePaid(briefId), router.refresh()))}>
                          {c.directBalance}
                        </button>
                      ) : (
                        <p className="text-center text-[0.85rem] text-bone-dim">{c.awaitingPayment}</p>
                      )
                    ) : (
                      <>
                        <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={collect}>
                          {fill(c.collect, { amount: remaining !== null ? fmt(remaining) : "" })}
                        </button>
                        <p className="text-center text-[0.8rem] text-bone-dim">{fill(c.collectLead, { amount: remaining !== null ? fmt(remaining) : "" })}</p>
                      </>
                    )}
                    {demo && !balance.paid && (
                      <a href={`/c/${chatToken}?from=studio`} className="v2-btn" data-tone="ghost">
                        {c.openAsClient}
                      </a>
                    )}
                    {error && (
                      <p role="alert" className="text-[0.88rem] text-accent">
                        {error}
                      </p>
                    )}
                  </div>
                </section>
              ) : stage === "open" || stage === "offered" || stage === "new" ? (
                <section className="v2-sheet p-4">
                  {evaluating ? (
                    <ConfirmForm
                      briefId={briefId}
                      stops={stops}
                      defaults={defaults}
                      currency={card.currency}
                      pending={pending}
                      t={t}
                      locale={locale}
                      onCancel={() => setEvaluating(false)}
                      onSubmit={(v) =>
                        start(async () => {
                          setError(null);
                          const r = await confirmQuote(briefId, v);
                          if (r?.error) setError(r.error);
                          else {
                            setEvaluating(false);
                            setJustSent(true);
                            router.refresh();
                          }
                        })
                      }
                    />
                  ) : stage === "offered" && direct ? (
                    <div className="grid gap-3">
                      <p className="text-[0.88rem] text-bone-dim">{c.directLead}</p>
                      <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={() => start(async () => { const r = await confirmDirectDeposit(briefId); if (r?.error) setError(r.error); else router.refresh(); })}>
                        {c.directConfirm}
                      </button>
                    </div>
                  ) : justSent || stage === "offered" ? (
                    <div className="grid gap-3 text-center">
                      <p className="p-display text-[1.5rem] leading-none text-[var(--color-olive,#6f8f5c)]">{c.sentTitle}</p>
                      <p className="text-[0.88rem] text-bone-dim">{c.sentLead}</p>
                      <button type="button" className="v2-btn" data-tone="accent" onClick={() => setOpen(false)}>
                        {c.backToChat}
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <p className="text-[0.88rem] text-bone-dim">{c.evaluateLead}</p>
                      <button type="button" className="v2-btn" data-tone="accent" onClick={() => setEvaluating(true)}>
                        {c.evaluate}
                      </button>
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="mt-2 text-[0.88rem] text-accent">
                      {error}
                    </p>
                  )}
                </section>
              ) : (
                <p className="px-1 text-bone-dim">{c.noBooking}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
