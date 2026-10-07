"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import type { FormState } from "../../../actions";
import { useSubmit } from "@/components/useSubmit";

interface Labels {
  price: string;
  priceFrom: string;
  priceTo: string;
  priceToHint: string;
  sessions: string;
  hours: string;
  deposit: string;
  depositHint: string;
  dates: string;
  datesHint: string;
  date: string;
  start: string;
  addDate: string;
  removeDate: string;
  stop: string;
  message: string;
  expires: string;
  days: string;
  send: string;
  sending: string;
  cancel: string;
  optional: string;
}

interface Slot {
  key: string;
  date: string;
  time: string;
  stopId: string;
}

export function QuoteForm(props: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  labels: Labels;
  stops: { id: string; label: string }[];
  defaultStop: string;
  defaultMessage: string;
  suggestedPrice: number | null;
  currencySymbol: string;
  cancelHref: string;
  minDate: string;
}) {
  const [state, action, pending] = useActionState(props.action, { ok: false, message: null });
  const onSubmit = useSubmit(action);
  const uid = useId();
  const l = props.labels;
  const [price, setPrice] = useState<string>(props.suggestedPrice ? String(props.suggestedPrice) : "");
  const [deposit, setDeposit] = useState<string>(props.suggestedPrice ? String(Math.max(50, Math.round((props.suggestedPrice * 0.2) / 50) * 50)) : "");
  const [depositEdited, setDepositEdited] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([{ key: "s0", date: "", time: "11:00", stopId: props.defaultStop }]);
  const err = (field: string) => (state.field === field ? state.message : null);

  return (
    <form onSubmit={onSubmit} className="grid gap-8" noValidate>
      <fieldset className="grid gap-4">
        <legend className="t-heading mb-1">{l.price}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Money id={`${uid}-min`} name="priceMin" label={l.priceFrom} symbol={props.currencySymbol} value={price} invalid={Boolean(err("priceMin"))}
            onChange={(v) => {
              setPrice(v);
              if (!depositEdited && Number(v) > 0) setDeposit(String(Math.max(50, Math.round((Number(v) * 0.2) / 50) * 50)));
            }}
          />
          <Money id={`${uid}-max`} name="priceMax" label={l.priceTo} symbol={props.currencySymbol} hint={l.priceToHint} optional={l.optional} invalid={Boolean(err("priceMax"))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${uid}-sessions`} className="t-label">
              {l.sessions}
            </label>
            <input id={`${uid}-sessions`} name="sessions" type="number" min={1} max={40} defaultValue={1} required className="input t-num" />
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${uid}-hours`} className="t-label">
              {l.hours} <span className="text-ash-dim">({l.optional})</span>
            </label>
            <input id={`${uid}-hours`} name="hours" type="number" min={1} max={14} step={0.5} placeholder="5" className="input t-num" />
          </div>
        </div>
        <Money id={`${uid}-deposit`} name="deposit" label={l.deposit} symbol={props.currencySymbol} hint={l.depositHint} value={deposit} invalid={Boolean(err("deposit"))}
          onChange={(v) => {
            setDeposit(v);
            setDepositEdited(true);
          }}
        />
        {(err("priceMin") || err("priceMax") || err("deposit")) && (
          <p role="alert" className="text-[0.88rem] text-oxblood">
            {state.message}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="t-heading mb-1">{l.dates}</legend>
        <p className="-mt-1 text-[0.9rem] text-ash">{l.datesHint}</p>
        <ul className="grid gap-3">
          {slots.map((slot, i) => (
            <li key={slot.key} className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-line p-3 sm:grid-cols-[1.2fr_0.8fr_1.2fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <label htmlFor={`${uid}-d${i}`} className="t-label">
                  {l.date}
                </label>
                <input id={`${uid}-d${i}`} name="slotDate" type="date" min={props.minDate} required className="input" value={slot.date}
                  onChange={(e) => setSlots((p) => p.map((s) => (s.key === slot.key ? { ...s, date: e.target.value } : s)))} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${uid}-t${i}`} className="t-label">
                  {l.start}
                </label>
                <input id={`${uid}-t${i}`} name="slotTime" type="time" step={900} required className="input" value={slot.time}
                  onChange={(e) => setSlots((p) => p.map((s) => (s.key === slot.key ? { ...s, time: e.target.value } : s)))} />
              </div>
              <div className="col-span-2 grid gap-1.5 sm:col-span-1">
                <label htmlFor={`${uid}-c${i}`} className="t-label">
                  {l.stop}
                </label>
                <select id={`${uid}-c${i}`} name="slotStop" className="input" value={slot.stopId}
                  onChange={(e) => setSlots((p) => p.map((s) => (s.key === slot.key ? { ...s, stopId: e.target.value } : s)))}>
                  {props.stops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {slots.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm col-span-2 justify-self-start sm:col-span-1" onClick={() => setSlots((p) => p.filter((s) => s.key !== slot.key))}>
                  {l.removeDate}
                </button>
              )}
            </li>
          ))}
        </ul>
        {slots.length < 6 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm w-fit"
            onClick={() => setSlots((p) => [...p, { key: `s${Date.now()}`, date: "", time: p.at(-1)?.time ?? "11:00", stopId: p.at(-1)?.stopId ?? props.defaultStop }])}
          >
            {l.addDate}
          </button>
        )}
        {err("slots") && (
          <p role="alert" className="text-[0.88rem] text-oxblood">
            {state.message}
          </p>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor={`${uid}-message`} className="t-heading mb-1">
          {l.message}
        </label>
        <textarea id={`${uid}-message`} name="message" className="input min-h-36" defaultValue={props.defaultMessage} maxLength={3000} />
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <label htmlFor={`${uid}-exp`} className="t-label">
          {l.expires}
        </label>
        <select id={`${uid}-exp`} name="expiresDays" defaultValue="7" className="input">
          {[3, 7, 14, 30].map((n) => (
            <option key={n} value={n}>
              {l.days.replace("{n}", String(n))}
            </option>
          ))}
        </select>
      </div>

      {state.message && !state.field && (
        <p role="alert" className="text-[0.88rem] text-oxblood">
          {state.message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-soot/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur sm:mx-0 sm:px-0">
        <Link href={props.cancelHref} className="btn btn-ghost">
          {l.cancel}
        </Link>
        <button type="submit" className="btn btn-primary min-w-40" disabled={pending} aria-busy={pending}>
          {pending ? l.sending : l.send}
        </button>
      </div>
    </form>
  );
}

function Money(props: {
  id: string;
  name: string;
  label: string;
  symbol: string;
  hint?: string;
  optional?: string;
  value?: string;
  invalid?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={props.id} className="t-label">
        {props.label} {props.optional && <span className="text-ash-dim">({props.optional})</span>}
      </label>
      <div className={`flex items-center rounded-[var(--radius-sm)] border ${props.invalid ? "border-oxblood" : "border-line-strong"} focus-within:border-gilt`}>
        <span className="pl-3 text-ash">{props.symbol}</span>
        <input
          id={props.id}
          name={props.name}
          type="number"
          inputMode="decimal"
          min={0}
          step={10}
          className="input t-num border-0 pl-1.5 focus:shadow-none"
          aria-invalid={props.invalid}
          aria-describedby={props.hint ? `${props.id}-hint` : undefined}
          {...(props.onChange ? { value: props.value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!(e.target.value) } : {})}
        />
      </div>
      {props.hint && (
        <p id={`${props.id}-hint`} className="text-[0.85rem] text-ash-dim">
          {props.hint}
        </p>
      )}
    </div>
  );
}
