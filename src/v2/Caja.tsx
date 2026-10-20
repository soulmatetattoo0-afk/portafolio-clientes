"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addExpense, removeExpense } from "@/app/studio/_legacy/actions";
import { fill, type Dict, type Locale } from "@/i18n";
import { money } from "@/lib/format";

export interface CajaMonth {
  label: string;
  income: number;
  deposits: number;
  sessions: number;
  expenses: number;
}
export interface CajaBar {
  label: string;
  income: number;
  expense: number;
  current: boolean;
}
export interface CajaMove {
  id: string;
  kind: "deposit" | "balance" | "expense";
  who: string;
  note: string | null;
  cents: number;
  day: string;
}

/**
 * Caja: the artist's till as a box-office receipt on paper, the circular
 * stamp inked over its corner, six months of takings as a skyline, and the
 * movements under it on ink: every deposit and session the app collected,
 * every expense they wrote down.
 */
export function Caja({ artist, month, bars, moves, currency, t, locale }: { artist: { display_name: string }; month: CajaMonth; bars: CajaBar[]; moves: CajaMove[]; currency: string; t: Dict; locale: Locale }) {
  const r = t.v2.room;
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = (c: number) => money(c, currency, locale);
  const balance = month.income - month.expenses;
  const max = Math.max(1, ...bars.map((b) => b.income));
  const weekOf = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
  };
  const dayLabel = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");
  const groups: { week: number; items: CajaMove[] }[] = [];
  for (const m of moves) {
    const w = weekOf(m.day);
    const g = groups[groups.length - 1];
    if (g && g.week === w) g.items.push(m);
    else groups.push({ week: w, items: [m] });
  }
  const submit = (f: FormData) =>
    start(async () => {
      setError(null);
      const res = await addExpense({ label: String(f.get("label") ?? ""), amount: Number(f.get("amount") ?? 0), day: String(f.get("day") ?? "") || undefined });
      if (res?.error) setError(res.error);
      else {
        setAdding(false);
        router.refresh();
      }
    });

  return (
    <section className="grid gap-5">
      {/* The receipt */}
      <div className="v2-receipt relative text-[#2b2420]">
        <div className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
        <Stamp text={fill(r.stamp, { artist: artist.display_name, month: month.label }).toUpperCase()} initial={artist.display_name[0]} />
        <p className="p-stamp text-[#2b2420]/70">
          {r.caja} · {month.label}
        </p>
        <div className="mt-2 border-t-2 border-[#2b2420] pt-3">
          <p className="p-stamp text-[#2b2420]/60">{r.balance}</p>
          <p className="p-display mt-1 text-[4.2rem] leading-[0.85] tabular-nums">{fmt(balance)}</p>
        </div>
        {/* Six months as a skyline: past months in halftone, this one in the accent, the expense bitten out of the top in stripes. */}
        <svg viewBox="0 0 300 120" className="mt-4 h-[120px] w-full" aria-label={r.months} role="img">
          <defs>
            <pattern id="caja-dots" width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.9" fill="#2b2420" />
            </pattern>
            <pattern id="caja-lines" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="1.2" height="3" fill="#2b2420" opacity="0.4" />
            </pattern>
          </defs>
          {bars.map((b, i) => {
            const w = 300 / bars.length;
            const x = i * w + w * 0.18;
            const bw = w * 0.64;
            const h = (b.income / max) * 86;
            const eh = Math.min(h, (b.expense / max) * 86);
            const top = 96 - h;
            return (
              <g key={b.label}>
                {h > 0 && <rect x={x} y={top} width={bw} height={h} fill={b.current ? "var(--accent)" : "url(#caja-dots)"} />}
                {eh > 0 && <rect x={x} y={top} width={bw} height={eh} fill="url(#caja-lines)" />}
                <line x1={x} x2={x + bw} y1={96} y2={96} stroke="#2b2420" strokeWidth="1.2" />
                <text x={x + bw / 2} y={112} textAnchor="middle" fontSize="9" letterSpacing="1.8" fill="#2b2420" fontFamily="var(--font-sans)">
                  {b.label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
        <dl className="mt-3 grid grid-cols-3 divide-x divide-dotted divide-[#2b2420]/40 border-t border-dotted border-[#2b2420]/40 pt-3">
          {[
            [r.income, fmt(month.income)],
            [r.deposits, fmt(month.deposits)],
            [r.expenses, fmt(month.expenses)],
          ].map(([k, v], i) => (
            <div key={k} className={i === 0 ? "pr-2" : "px-2"}>
              <dt className="p-stamp text-[#2b2420]/60">{k}</dt>
              <dd className="p-display mt-0.5 text-[1.45rem] leading-none tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* The movements, folded under the receipt. */}
      <details className="group px-1">
        <summary className="v2-btn cursor-pointer list-none justify-self-start bg-bone/10 text-bone marker:hidden [&::-webkit-details-marker]:hidden">{r.movements}</summary>
      <div className="mt-4 grid gap-4">
        {groups.length === 0 && <p className="text-bone-dim">{r.empty}</p>}
        {groups.map((g) => (
          <div key={g.week}>
            <p className="p-stamp text-bone/50">{fill(r.week, { n: g.week })}</p>
            <ul className="mt-1 grid">
              {g.items.map((m) => (
                <li key={m.id} className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 py-2.5">
                  <span className="p-display text-[1rem] leading-[0.95] uppercase text-bone/90">{dayLabel(m.day)}</span>
                  <span className="flex min-w-0 items-end gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[0.95rem] font-semibold text-bone">{m.who}</span>
                      <span className="p-stamp block text-bone/55">{m.kind === "deposit" ? r.deposit : m.kind === "balance" ? r.sessionPaid : r.expense}{m.note ? ` · ${m.note}` : ""}</span>
                    </span>
                    <span aria-hidden className="mb-[0.5em] min-w-4 flex-1 border-b border-dotted border-bone/25" />
                  </span>
                  <span className="flex items-center gap-2 text-[1rem] font-semibold tabular-nums">
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
                      <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
                      {m.kind === "deposit" && <path d="M5 1a4 4 0 0 1 0 8z" fill="currentColor" />}
                      {m.kind === "balance" && <circle cx="5" cy="5" r="4" fill="currentColor" />}
                    </svg>
                    {m.kind === "expense" ? <span className="text-bone/70">−{fmt(m.cents)}</span> : <span className="text-bone">{fmt(m.cents)}</span>}
                    {m.kind === "expense" && (
                      <button type="button" className="text-[0.7rem] text-bone/40 underline underline-offset-2" disabled={pending} onClick={() => start(async () => (await removeExpense(m.id), router.refresh()))}>
                        {r.remove}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {adding ? (
        <form
          className="v2-sheet mt-4 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <label className="v2-field">
            <span>{r.expenseLabel}</span>
            <input name="label" required maxLength={120} className="v2-input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="v2-field">
              <span>{r.expenseAmount}</span>
              <input name="amount" type="number" inputMode="decimal" min={1} step="0.01" required className="v2-input" />
            </label>
            <label className="v2-field">
              <span>{r.expenseDay}</span>
              <input name="day" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="v2-input" />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-[0.88rem] text-accent">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="v2-btn flex-1" data-tone="accent" disabled={pending}>
              {r.save}
            </button>
            <button type="button" className="v2-btn" data-tone="ghost" onClick={() => setAdding(false)}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="v2-btn mt-4 justify-self-start bg-bone text-ink">
          + {r.addExpense}
        </button>
      )}
      </details>
    </section>
  );
}

/** The circular rubber stamp inked over the receipt's corner. */
function Stamp({ text, initial }: { text: string; initial: string }) {
  return (
    <svg viewBox="0 0 112 112" className="v2-stamp absolute -right-2 -top-6 h-[112px] w-[112px]" aria-hidden>
      <defs>
        <path id="caja-ring" d="M56 56 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0" />
      </defs>
      <circle cx="56" cy="56" r="52" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="56" cy="56" r="30" fill="none" stroke="var(--accent)" strokeWidth="0.75" />
      <text fontSize="8.5" fontWeight="600" letterSpacing="2.6" fill="var(--accent)" fontFamily="var(--font-sans)">
        <textPath href="#caja-ring">{text} ·</textPath>
      </text>
      <text x="56" y="66" textAnchor="middle" fontSize="30" fill="var(--accent)" fontFamily="Anton, var(--font-poster), sans-serif">
        {initial}
      </text>
    </svg>
  );
}
