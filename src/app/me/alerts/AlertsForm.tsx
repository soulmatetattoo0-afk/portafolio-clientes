"use client";

import { useActionState } from "react";

import { useSubmit } from "@/components/useSubmit";
import type { ClientUser } from "@/lib/client";

import { savePrefs, type FormState } from "../actions";

type Key = keyof ClientUser["alerts"];

/** Four switches, one save. Each row is one tap: the whole label toggles it. */
export function AlertsForm({ alerts, labels }: { alerts: ClientUser["alerts"]; labels: { save: string; saved: string; items: { key: Key; label: string; hint: string }[] } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePrefs, { ok: false, error: null });
  const onSubmit = useSubmit(action);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <ul className="divide-y divide-line border-y border-line">
        {labels.items.map((item) => (
          <li key={item.key}>
            <label htmlFor={`alert-${item.key}`} className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
              <span className="min-w-0">
                <span className="block text-bone">{item.label}</span>
                <span className="block text-[0.88rem] text-bone-dim">{item.hint}</span>
              </span>
              <span className="relative inline-flex h-11 w-14 shrink-0 items-center">
                <input id={`alert-${item.key}`} name={item.key} type="checkbox" defaultChecked={alerts[item.key]} className="peer sr-only" />
                <span aria-hidden className="h-7 w-12 rounded-full border border-line-strong bg-ink-2 transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-bone/60" />
                <span aria-hidden className="absolute left-1 h-5 w-5 rounded-full bg-bone-dim transition-transform peer-checked:translate-x-5 peer-checked:bg-ink" />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" aria-busy={pending}>
          {labels.save}
        </button>
        <p role="status" className={`text-[0.9rem] ${state.ok ? "text-accent" : state.error ? "text-ember" : "sr-only"}`}>
          {state.ok ? labels.saved : (state.error ?? "")}
        </p>
      </div>
    </form>
  );
}
