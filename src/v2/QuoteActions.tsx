"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelBooking, confirmDirectDeposit, confirmQuote, declineBrief, finishTattoo, markBalancePaid, moveBooking, sendArtistMessage } from "@/app/studio/_legacy/actions";
import { fill, type Dict, type Locale } from "@/i18n";
import type { Balance } from "@/lib/balance";
import { money } from "@/lib/format";

export type QuoteStage = "new" | "open" | "offered" | "booked" | "paid" | "closed";

/**
 * Under the client's letter, what the artist does with it, one step at a
 * time: accept it (the chat opens), confirm the quote (date, total and
 * deposit: the client gets the booking link), and when the tattoo is done,
 * collect the balance. Each state says where things stand.
 */
export function QuoteActions({ briefId, stage, clientName, stops, defaults, balance, bookedOn, booking, currency, template, direct = false, t, locale }: { briefId: string; stage: QuoteStage; direct?: boolean; booking?: { date: string; time: string; hours: number; deposit: string } | null; clientName: string; stops: { id: string; label: string }[]; defaults: { deposit: number | null; hours: number | null; start: string | null; date?: string | null; stopId?: string | null; client?: string }; balance: Balance | null; bookedOn: string | null; currency: string; template: string; t: Dict; locale: Locale }) {
  const c = t.v2.chats;
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "decline" | "confirm" | "move" | "cancel" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const first = clientName.split(" ")[0];
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setMode(null);
        router.refresh();
      }
    });

  const balanceAmount = balance && balance.amountCents !== null ? money(balance.amountCents, balance.currency, locale) : null;

  return (
    <div className="v2-sheet mt-2 grid gap-3 p-3">
      {stage === "new" && mode !== "accept" && mode !== "decline" && (
        <div className="grid gap-2">
          <button type="button" className="v2-btn" data-tone="accent" onClick={() => setMode("accept")}>
            {c.accept}
          </button>
          <button type="button" className="h-10 text-[0.85rem] text-bone-dim underline underline-offset-4" onClick={() => setMode("decline")}>
            {c.decline}
          </button>
        </div>
      )}
      {mode === "accept" && (
        <MessageForm lead={fill(c.acceptLead, { name: first })} initial={template} submit={c.sendMessage} pending={pending} onCancel={() => setMode(null)} onSubmit={(text) => run(() => sendArtistMessage(briefId, text))} t={t} />
      )}
      {mode === "decline" && (
        <MessageForm
          lead={fill(t.studio.decline.lead, { name: first })}
          initial={fill(t.templates.decline, { name: first })}
          submit={c.decline}
          tone="danger"
          pending={pending}
          onCancel={() => setMode(null)}
          onSubmit={(text) =>
            run(async () => {
              const f = new FormData();
              f.set("message", text);
              const r = await declineBrief(briefId, { ok: false, message: null }, f);
              return r.ok ? undefined : { error: r.message ?? t.common.error };
            })
          }
          t={t}
        />
      )}

      {(stage === "open" || stage === "offered") && mode !== "confirm" && (
        <div className="grid gap-2">
          {stage === "offered" && <p className="text-center text-[0.85rem] text-bone-dim">{c.sent}</p>}
          {stage === "offered" && direct ? (
            <>
              <p className="text-[0.85rem] text-bone-dim">{c.directLead}</p>
              <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={() => run(() => confirmDirectDeposit(briefId))}>
                {c.directConfirm}
              </button>
            </>
          ) : (
            <button type="button" className="v2-btn" data-tone="accent" onClick={() => setMode("confirm")}>
              {c.confirm}
            </button>
          )}
        </div>
      )}
      {mode === "confirm" && <ConfirmForm briefId={briefId} stops={stops} defaults={defaults} currency={currency} pending={pending} t={t} locale={locale} onCancel={() => setMode(null)} onSubmit={(v) => run(() => confirmQuote(briefId, v))} />}

      {stage === "booked" && (
        <div className="grid gap-2">
          <p className="text-center text-[0.85rem] font-semibold text-[var(--color-olive,#6f8f5c)]">{c.depositPaid}</p>
          <p className="text-center text-[0.85rem] text-bone-dim">{fill(c.reserved, { date: bookedOn ?? "" })}</p>
          {balance?.requested ? (
            // The charge is out: say so, and keep the way to mark it paid by hand.
            <>
              <p className="rounded-[14px] border border-accent/40 bg-accent/10 px-3 py-2.5 text-center text-[0.88rem] font-semibold text-bone">{fill(c.requested, { amount: balanceAmount ?? "" })}</p>
              <p className="text-center text-[0.8rem] text-bone-dim">{fill(direct ? c.requestedDirect : c.requestedLead, { name: first })}</p>
            </>
          ) : (
            <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={() => run(() => finishTattoo(briefId))}>
              {fill(c.finish, { amount: balanceAmount ?? "" })}
            </button>
          )}
          <button type="button" className={direct || balance?.requested ? "v2-btn" : "h-10 text-[0.85rem] text-bone-dim underline underline-offset-4"} data-tone={direct || balance?.requested ? "ghost" : undefined} disabled={pending} onClick={() => run(() => markBalancePaid(briefId))}>
            {direct ? c.directBalance : c.cash}
          </button>
          {/* The date itself: move it, or call it off. */}
          {!balance?.requested && mode === null && booking && (
            <div className="mt-1 grid grid-cols-2 gap-2 border-t border-bone/10 pt-3">
              <button type="button" className="h-10 rounded-full border border-bone/20 text-[0.85rem] font-semibold text-bone" onClick={() => setMode("move")}>
                {c.moveBooking}
              </button>
              <button type="button" className="h-10 rounded-full border border-bone/20 text-[0.85rem] font-semibold text-bone/80" onClick={() => setMode("cancel")}>
                {c.cancelBooking}
              </button>
            </div>
          )}
          {mode === "move" && booking && <MoveForm initial={booking} name={first} pending={pending} t={t} onCancel={() => setMode(null)} onSubmit={(v) => run(() => moveBooking(briefId, v))} />}
          {mode === "cancel" && booking && (
            <div className="grid gap-2 border-t border-bone/10 pt-3">
              <p className="p-display text-[1.3rem] leading-none">{c.cancelTitle}</p>
              <p className="text-[0.85rem] leading-snug text-bone-dim">{fill(c.cancelLead, { name: first })}</p>
              <button type="button" className="v2-btn" data-tone="accent" disabled={pending} onClick={() => run(() => cancelBooking(briefId, true))}>
                {fill(c.cancelRefund, { amount: booking.deposit })}
              </button>
              <button type="button" className="v2-btn" data-tone="ghost" disabled={pending} onClick={() => run(() => cancelBooking(briefId, false))}>
                {c.cancelKeep}
              </button>
              <button type="button" className="h-10 text-[0.85rem] text-bone-dim underline underline-offset-4" onClick={() => setMode(null)}>
                {c.keepBooking}
              </button>
            </div>
          )}
        </div>
      )}
      {stage === "paid" && (
        <div className="grid gap-1 text-center">
          <p className="text-[0.85rem] font-semibold text-bone">{c.finished}</p>
          {balanceAmount && <p className="text-[0.82rem] text-[var(--color-olive,#6f8f5c)]">{fill(c.paidNote, { amount: balanceAmount })}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[0.88rem] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

function MessageForm({ lead, initial, submit, tone = "accent", pending, onCancel, onSubmit, t }: { lead: string; initial: string; submit: string; tone?: "accent" | "danger"; pending: boolean; onCancel: () => void; onSubmit: (text: string) => void; t: Dict }) {
  const [text, setText] = useState(initial);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
      }}
    >
      <p className="text-[0.9rem] text-bone/85">{lead}</p>
      <textarea className="v2-input" value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="v2-btn flex-1" data-tone={tone} disabled={pending || !text.trim()}>
          {submit}
        </button>
        <button type="button" className="v2-btn" data-tone="ghost" onClick={onCancel}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}

export function ConfirmForm({ stops, defaults, currency, pending, t, locale, onCancel, onSubmit }: { briefId: string; stops: { id: string; label: string }[]; defaults: { deposit: number | null; hours: number | null; start: string | null; date?: string | null; stopId?: string | null; client?: string }; currency: string; pending: boolean; t: Dict; locale: Locale; onCancel: () => void; onSubmit: (v: { date: string; time: string; hours: number; stopId: string; total: number; deposit: number; message: string }) => void }) {
  const c = t.v2.chats;
  const today = new Date().toISOString().slice(0, 10);
  // The day the client asked for comes in chosen; the artist can suggest another.
  const asked = defaults.date && defaults.date >= today ? defaults.date : null;
  const [other, setOther] = useState(!asked);
  const [v, setV] = useState({ date: asked ?? "", time: defaults.start ?? "12:00", hours: String(defaults.hours ?? 3), stopId: (defaults.stopId && stops.some((s) => s.id === defaults.stopId) ? defaults.stopId : stops[0]?.id) ?? "", price: "", sessions: "1", deposit: String(defaults.deposit ?? 100), message: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const total = (Number(v.price) || 0) * Math.max(1, Math.round(Number(v.sessions) || 1));
  const deposit = Number(v.deposit) || 0;
  const balance = Math.max(0, total - deposit);
  const fmt = (n: number) => money(Math.round(n * 100), currency, locale);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(v.date) && !Number.isNaN(new Date(`${v.date}T12:00:00Z`).getTime());
  const ready = validDate && v.time && total > 0 && deposit >= 0 && deposit <= total && v.stopId;
  const when = validDate ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${v.date}T12:00:00Z`)) : "";
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ date: v.date, time: v.time, hours: Number(v.hours) || 3, stopId: v.stopId, total, deposit, message: v.message });
      }}
    >
      <p className="p-display text-[1.4rem] leading-none">{c.confirm}</p>
      <p className="text-[0.88rem] text-bone-dim">{c.confirmLead}</p>
      {asked && !other ? (
        <div className="flex items-center justify-between gap-3 rounded-[16px] border border-accent/40 bg-accent/10 px-4 py-3">
          <span className="min-w-0">
            <span className="p-stamp block text-bone/60">{fill(c.askedDate, { name: defaults.client ?? "" })}</span>
            <span className="p-display mt-1 block text-[1.35rem] uppercase leading-none">{when}</span>
          </span>
          <button type="button" className="shrink-0 rounded-full border border-bone/30 px-3 py-2 text-[0.78rem] font-semibold text-bone" onClick={() => setOther(true)}>
            {c.suggestDate}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {other && (
          <label className="v2-field col-span-2">
            <span>{asked ? c.otherDate : c.date}</span>
            <input type="date" className="v2-input" min={today} value={v.date} onChange={set("date")} required />
          </label>
        )}
        <label className="v2-field">
          <span>{c.time}</span>
          <input type="time" className="v2-input" value={v.time} onChange={set("time")} required />
        </label>
        <label className="v2-field">
          <span>{c.hours}</span>
          <input type="number" className="v2-input" min={1} max={14} step={0.5} value={v.hours} onChange={set("hours")} />
        </label>
        <label className="v2-field">
          <span>{c.place}</span>
          <select className="v2-input" value={v.stopId} onChange={set("stopId")}>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="v2-field">
          <span>{c.price}</span>
          <input type="number" inputMode="decimal" className="v2-input" min={1} value={v.price} onChange={set("price")} required />
        </label>
        <label className="v2-field">
          <span>{c.sessionsN}</span>
          <input type="number" inputMode="numeric" className="v2-input" min={1} max={40} step={1} value={v.sessions} onChange={set("sessions")} required />
        </label>
        <label className="v2-field">
          <span>{c.deposit}</span>
          <input type="number" inputMode="decimal" className="v2-input" min={0} value={v.deposit} onChange={set("deposit")} required />
        </label>
      </div>
      <div className="rounded-[16px] bg-bone/8 px-4 py-3">
        <p className="p-stamp text-bone/60">{c.total}</p>
        <p className="p-display text-[1.5rem] leading-none">{fmt(total)}</p>
        <p className="p-stamp mt-2 text-bone/60">{c.balance}</p>
        <p className="p-display text-[2rem] leading-none text-accent">{fmt(balance)}</p>
        {ready && <p className="mt-1 text-[0.82rem] text-bone-dim">{fill(c.summary, { date: when, time: v.time, deposit: fmt(deposit), balance: fmt(balance) })}</p>}
        {ready && deposit === 0 && <p className="mt-1 text-[0.82rem] font-semibold text-bone">{c.noDeposit}</p>}
      </div>
      <label className="v2-field">
        <span>{c.message}</span>
        <textarea className="v2-input" maxLength={1000} value={v.message} onChange={set("message")} style={{ minHeight: "4.5rem" }} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="v2-btn flex-1" data-tone="accent" disabled={pending || !ready}>
          {c.send}
        </button>
        <button type="button" className="v2-btn" data-tone="ghost" onClick={onCancel}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}

/** Move a booked session: the same fields as the confirmation, filled with the current date. */
function MoveForm({ initial, name, pending, t, onCancel, onSubmit }: { initial: { date: string; time: string; hours: number }; name: string; pending: boolean; t: Dict; onCancel: () => void; onSubmit: (v: { date: string; time: string; hours: number }) => void }) {
  const c = t.v2.chats;
  const [v, setV] = useState({ date: initial.date, time: initial.time, hours: String(initial.hours) });
  const today = new Date().toISOString().slice(0, 10);
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(v.date) && /^\d{2}:\d{2}$/.test(v.time) && Number(v.hours) >= 0.5;
  return (
    <form
      className="grid gap-3 border-t border-bone/10 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ date: v.date, time: v.time, hours: Number(v.hours) });
      }}
    >
      <p className="p-display text-[1.3rem] leading-none">{c.moveTitle}</p>
      <p className="text-[0.85rem] text-bone-dim">{fill(c.moveLead, { name })}</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="v2-field col-span-3">
          <span>{c.date}</span>
          <input type="date" className="v2-input" min={today} value={v.date} onChange={(e) => setV((p) => ({ ...p, date: e.target.value }))} required />
        </label>
        <label className="v2-field col-span-2">
          <span>{c.time}</span>
          <input type="time" className="v2-input" value={v.time} onChange={(e) => setV((p) => ({ ...p, time: e.target.value }))} required />
        </label>
        <label className="v2-field">
          <span>{c.hours}</span>
          <input type="number" className="v2-input" min={0.5} max={14} step={0.5} value={v.hours} onChange={(e) => setV((p) => ({ ...p, hours: e.target.value }))} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="v2-btn flex-1" data-tone="accent" disabled={pending || !ready}>
          {c.moveSave}
        </button>
        <button type="button" className="v2-btn" data-tone="ghost" onClick={onCancel}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
