"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addExpense, removeExpense } from "@/app/studio/_legacy/actions";
import { fill, type Dict, type Locale } from "@/i18n";
import { money } from "@/lib/format";

export type ExpenseCategory = "supplies" | "rent" | "ads" | "travel" | "other";
export interface BookMove {
  id: string;
  kind: "deposit" | "balance" | "expense";
  who: string;
  note: string | null;
  cents: number;
  day: string;
  category?: ExpenseCategory;
}
export interface BookMonth {
  key: string;
  label: string;
  income: number;
  deposits: number;
  sessions: number;
  expenses: number;
  toCollect: { n: number; cents: number };
  prev: string;
  next: string | null;
}

const CATEGORIES: ExpenseCategory[] = ["supplies", "rent", "ads", "travel", "other"];

/**
 * Caja, in the language of the artist's page: the month's profit on the red
 * band, three doors for deposits, sessions and expenses, six months as plain
 * bars, what's still to collect, and every movement by day. Expenses go in
 * from a sheet at the thumb, each in its category.
 */
export function CajaBook({ month, bars, moves, currency, t, locale }: { month: BookMonth; bars: { key: string; label: string; income: number; expense: number; current: boolean }[]; moves: BookMove[]; currency: string; t: Dict; locale: Locale }) {
  const c = t.v2.caja;
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ label: string; amount: string; day: string; category: ExpenseCategory }>({ label: "", amount: "", day: "", category: "supplies" });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = (n: number) => money(n, currency, locale);
  const profit = month.income - month.expenses;
  const max = Math.max(1, ...bars.map((b) => Math.max(b.income, b.expense)));
  const days = new Map<string, BookMove[]>();
  for (const m of moves) days.set(m.day, [...(days.get(m.day) ?? []), m]);
  const dayLabel = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const save = () =>
    start(async () => {
      setError(null);
      const res = await addExpense({ label: form.label, amount: Number(form.amount), day: form.day || undefined, category: form.category });
      if (res?.error) setError(res.error);
      else {
        setAdding(false);
        setForm({ label: "", amount: "", day: "", category: "supplies" });
        router.refresh();
      }
    });

  return (
    <div className="grid gap-3">
      {/* The month */}
      <div className="flex items-center justify-between px-1">
        <Link href={`/studio/sala/caja?m=${month.prev}`} className="grid h-10 w-10 place-items-center rounded-full border border-bone/20 text-bone" aria-label={c.prev}>
          ‹
        </Link>
        <p className="p-display text-[1.6rem] uppercase leading-none">{month.label}</p>
        {month.next ? (
          <Link href={`/studio/sala/caja?m=${month.next}`} className="grid h-10 w-10 place-items-center rounded-full border border-bone/20 text-bone" aria-label={c.next}>
            ›
          </Link>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      {/* The profit, on the red band */}
      <div className="ed-tile ed-book px-5 py-5">
        <span className="relative block">
          <Num n={1} tone="ink" />
          <span className="p-stamp mt-2 block text-ink/75">{c.profit}</span>
          <span className="p-display mt-1 block text-[clamp(3rem,15vw,4.6rem)] leading-[0.85] text-ink tabular-nums">{fmt(profit)}</span>
          <span className="mt-2 block text-[0.85rem] text-ink/80">{fill(c.profitLine, { income: fmt(month.income), expenses: fmt(month.expenses) })}</span>
        </span>
      </div>

      {/* Three doors */}
      <div className="grid grid-cols-3 gap-2">
        {[
          [2, c.deposits, month.deposits],
          [3, c.sessions, month.sessions],
          [4, c.expenses, month.expenses],
        ].map(([n, label, v]) => (
          <div key={String(label)} className="ed-tile p-3">
            <Num n={n as number} />
            <span className="p-display mt-2 block text-[1.45rem] leading-none tabular-nums">{fmt(v as number)}</span>
            <span className="p-stamp mt-1 block text-[0.55rem] text-bone/60">{label}</span>
          </div>
        ))}
      </div>

      {month.toCollect.n > 0 && (
        <Link href="/studio/chats?tab=accepted" className="ed-tile flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="p-stamp block text-bone/60">{c.toCollect}</span>
            <span className="text-[0.92rem]">{fill(month.toCollect.n === 1 ? c.toCollectOne : c.toCollectN, { n: month.toCollect.n })}</span>
          </span>
          <span className="p-display text-[1.5rem] leading-none text-accent tabular-nums">{fmt(month.toCollect.cents)}</span>
        </Link>
      )}

      {/* Six months */}
      <div className="ed-tile px-4 pt-4 pb-3">
        <Num n={5} />
        <p className="p-display mt-1 text-[1.5rem] uppercase leading-none">{c.months}</p>
        <div className="mt-4 flex h-28 items-end gap-2">
          {bars.map((b) => (
            <Link key={b.key} href={`/studio/sala/caja?m=${b.key}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="flex w-full flex-1 items-end justify-center gap-[3px]">
                <span className={`w-1/2 max-w-4 rounded-t-[5px] ${b.current ? "bg-bone" : "bg-bone/30"}`} style={{ height: `${Math.max(3, (b.income / max) * 100)}%` }} />
                <span className="w-1/3 max-w-3 rounded-t-[5px] bg-accent/60" style={{ height: `${b.expense ? Math.max(3, (b.expense / max) * 100) : 0}%` }} />
              </span>
              <span className={`p-stamp text-[0.55rem] ${b.current ? "text-bone" : "text-bone/50"}`}>{b.label}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-4 text-[0.72rem] text-bone/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-bone" /> {c.legendIncome}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-accent/60" /> {c.legendExpense}
          </span>
        </p>
      </div>

      {/* Movements */}
      <div className="mt-3 px-1">
        <Num n={6} />
        <p className="p-display mt-1 text-[1.5rem] uppercase leading-none">{c.movements}</p>
      </div>
      {moves.length === 0 ? (
        <p className="px-1 text-[0.92rem] text-bone-dim">{c.empty}</p>
      ) : (
        <div className="grid gap-3">
          {[...days].map(([day, list]) => (
            <div key={day}>
              <p className="p-stamp px-1 text-bone/50">{dayLabel(day)}</p>
              <ul className="mt-1 grid divide-y divide-bone/10 rounded-[18px] border border-bone/10 bg-ink-2/60">
                {list.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.95rem] ${m.kind === "expense" ? "bg-accent/15 text-accent" : "bg-bone/10 text-bone"}`} aria-hidden>
                      {m.kind === "expense" ? "−" : m.kind === "deposit" ? "◐" : "●"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold">{m.who}</span>
                      <span className="block truncate text-[0.78rem] text-bone-dim">
                        {m.kind === "deposit" ? c.deposit : m.kind === "balance" ? c.session : c.category[m.category ?? "other"]}
                        {m.note ? ` · ${m.note}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[1rem] font-semibold tabular-nums ${m.kind === "expense" ? "text-bone/70" : ""}`}>
                      {m.kind === "expense" ? "−" : "+"}
                      {fmt(m.cents)}
                    </span>
                    {m.kind === "expense" && (
                      <button type="button" aria-label={c.remove} className="shrink-0 px-1 text-bone/40" disabled={pending} onClick={() => start(async () => (await removeExpense(m.id), router.refresh()))}>
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="h-16" aria-hidden />
      <button type="button" onClick={() => setAdding(true)} className="v2-fab">
        + {c.addExpense}
      </button>

      {adding && (
        <div role="dialog" aria-modal="true" className="poster fixed inset-0 z-[80] flex items-end bg-ink/70 backdrop-blur-sm" onClick={() => setAdding(false)}>
          <form
            className="w-full rounded-t-[26px] border-t border-bone/15 bg-ink-2 px-4 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (form.label.trim() && Number(form.amount) > 0) save();
            }}
          >
            <p className="p-display text-[1.7rem] uppercase leading-none">{c.newExpense}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((k) => (
                <button key={k} type="button" aria-pressed={form.category === k} onClick={() => setForm((f) => ({ ...f, category: k }))} className={`rounded-full border px-3 py-1.5 text-[0.85rem] ${form.category === k ? "border-bone bg-bone text-ink" : "border-bone/25 text-bone"}`}>
                  {c.category[k]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3">
              <label className="v2-field">
                <span>{c.what}</span>
                <input className="v2-input" maxLength={120} required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={c.whatHint} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="v2-field">
                  <span>{c.amount}</span>
                  <input className="v2-input" type="number" inputMode="decimal" min={1} step="0.01" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
                <label className="v2-field">
                  <span>{c.day}</span>
                  <input className="v2-input" type="date" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} />
                </label>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-[0.88rem] text-accent">
                {error}
              </p>
            )}
            <button type="submit" className="v2-btn mt-4 w-full" data-tone="accent" disabled={pending}>
              {c.save}
            </button>
            <button type="button" className="mt-1 h-11 w-full text-[0.88rem] text-bone-dim" onClick={() => setAdding(false)}>
              {t.common.cancel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Num({ n, tone = "bone" }: { n: number; tone?: "bone" | "ink" }) {
  return (
    <span className={`flex items-center gap-2 text-[0.62rem] font-medium tracking-[0.12em] ${tone === "bone" ? "text-bone/85" : "text-ink/80"}`}>
      {String(n).padStart(2, "0")}
      <span className={`h-px w-8 ${tone === "bone" ? "bg-bone/70" : "bg-ink/70"}`} />
    </span>
  );
}
