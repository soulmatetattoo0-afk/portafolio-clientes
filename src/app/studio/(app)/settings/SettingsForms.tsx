"use client";

import { useActionState } from "react";

import { useSubmit } from "@/components/useSubmit";
import type { Locale } from "@/i18n";
import { STYLES } from "@/lib/catalog";
import type { Artist } from "@/lib/queries";

import { saveProfile, saveRules, type FormState } from "../actions";

type L = Record<string, string>;

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-[0.9rem] ${state.ok ? "text-verdigris" : "text-oxblood"}`}>
      {state.message}
    </p>
  );
}

function Text(props: { name: string; label: string; defaultValue?: string | null; hint?: string; textarea?: boolean; type?: string; optional?: string; max?: number; prefix?: string }) {
  const id = `set-${props.name}`;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="t-label">
        {props.label} {props.optional && <span className="text-ash-dim">({props.optional})</span>}
      </label>
      {props.textarea ? (
        <textarea id={id} name={props.name} className="input min-h-32" defaultValue={props.defaultValue ?? ""} maxLength={props.max} aria-describedby={props.hint ? `${id}-hint` : undefined} />
      ) : props.prefix ? (
        <div className="flex items-center rounded-[var(--radius-sm)] border border-line-strong focus-within:border-gilt">
          <span className="pl-3 text-ash">{props.prefix}</span>
          <input id={id} name={props.name} type={props.type ?? "text"} className="input border-0 pl-1.5 focus:shadow-none" defaultValue={props.defaultValue ?? ""} maxLength={props.max} aria-describedby={props.hint ? `${id}-hint` : undefined} />
        </div>
      ) : (
        <input id={id} name={props.name} type={props.type ?? "text"} className="input" defaultValue={props.defaultValue ?? ""} maxLength={props.max} aria-describedby={props.hint ? `${id}-hint` : undefined} />
      )}
      {props.hint && (
        <p id={`${id}-hint`} className="text-[0.85rem] text-ash-dim">
          {props.hint}
        </p>
      )}
    </div>
  );
}

export function ProfileForm({ artist, labels, locale }: { artist: Artist; labels: L; locale: Locale }) {
  const [state, action, pending] = useActionState(saveProfile, { ok: false, message: null });
  const submit = useSubmit(action);
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Text name="display_name" label={labels.name} defaultValue={artist.display_name} max={80} />
        <Text name="instagram" label={labels.instagram} defaultValue={artist.instagram} prefix="@" max={60} optional={labels.optional} />
      </div>
      <Text name="headline" label={labels.headline} hint={labels.headlineHint} defaultValue={artist.headline} max={140} optional={labels.optional} />
      <Text name="bio" label={labels.bio} defaultValue={artist.bio} textarea max={1500} optional={labels.optional} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Text name="home_city" label={labels.homeCity} defaultValue={artist.home_city} max={80} />
        <Text name="min_price" type="number" label={labels.minPrice} hint={labels.minPriceHint} defaultValue={artist.min_price_cents ? String(artist.min_price_cents / 100) : ""} prefix="$" optional={labels.optional} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="t-label mb-2">{labels.styles}</legend>
        <div className="flex flex-wrap gap-2">
          {STYLES.filter((s) => s.slug !== "other").map((s) => (
            <label key={s.slug} className="chip has-[:checked]:border-gilt has-[:checked]:text-gilt-bright">
              <input type="checkbox" name="styles" value={s.slug} defaultChecked={artist.styles.includes(s.slug)} className="h-3.5 w-3.5" />
              {s.label[locale]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="accepting" className="h-4 w-4" defaultChecked={artist.accepting} />
        {labels.accepting}
      </label>
      <Status state={state} />
      <button type="submit" className="btn btn-primary w-fit" disabled={pending}>
        {labels.save}
      </button>
    </form>
  );
}

export function RulesForm({ artist, labels }: { artist: Artist; labels: L }) {
  const [state, action, pending] = useActionState(saveRules, { ok: false, message: null });
  const submit = useSubmit(action);
  const p = artist.deposit_policy;
  return (
    <form onSubmit={submit} className="grid gap-5">
      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="refundable" className="h-4 w-4" defaultChecked={p.refundable} />
        {labels.refundable}
      </label>
      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="applies_to_final_price" className="h-4 w-4" defaultChecked={p.applies_to_final_price} />
        {labels.appliesToFinal}
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <Text name="reschedule_notice_hours" type="number" label={labels.rescheduleHours} defaultValue={String(p.reschedule_notice_hours)} />
        <Text name="reschedules_allowed" type="number" label={labels.reschedules} defaultValue={String(p.reschedules_allowed)} />
      </div>
      <Status state={state} />
      <button type="submit" className="btn btn-primary w-fit" disabled={pending}>
        {labels.save}
      </button>
    </form>
  );
}
