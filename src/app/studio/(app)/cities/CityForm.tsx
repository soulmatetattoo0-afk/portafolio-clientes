"use client";

import { useActionState, useState, useTransition } from "react";

import { useSubmit } from "@/components/useSubmit";
import type { TourStop } from "@/lib/queries";

import { deleteStop, notifyWaitlist, saveStop, type FormState } from "../actions";

interface Labels {
  add: string;
  city: string;
  country: string;
  studio: string;
  address: string;
  timezone: string;
  starts: string;
  ends: string;
  home: string;
  status: string;
  save: string;
  notify: string;
  delete: string;
  cancel: string;
  edit: string;
  statuses: Record<TourStop["status"], string>;
  optional: string;
}

export function CityForm({ stop, labels, timezones, onDone }: { stop?: TourStop; labels: Labels; timezones: string[]; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await saveStop(prev, form);
    if (r.ok) onDone?.();
    return r;
  }, { ok: false, message: null });
  const submit = useSubmit(action);
  const id = stop?.id ?? "new";
  const bad = (f: string) => state.field === f;
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-niche p-4 sm:p-5">
      {stop && <input type="hidden" name="id" value={stop.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={`${id}-city`} name="city" label={labels.city} defaultValue={stop?.city} required invalid={bad("city")} />
        <Input id={`${id}-country`} name="country" label={labels.country} defaultValue={stop?.country} />
        <Input id={`${id}-studio`} name="studio_name" label={labels.studio} defaultValue={stop?.studio_name ?? ""} optional={labels.optional} />
        <Input id={`${id}-address`} name="address" label={labels.address} defaultValue={stop?.address ?? ""} optional={labels.optional} />
        <label className="grid content-start gap-1.5">
          <span className="t-label">{labels.timezone}</span>
          <select name="timezone" className="input" defaultValue={stop?.timezone ?? "America/New_York"}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid content-start gap-1.5">
          <span className="t-label">{labels.status}</span>
          <select name="status" className="input" defaultValue={stop?.status ?? "announced"}>
            {(Object.keys(labels.statuses) as TourStop["status"][]).map((s) => (
              <option key={s} value={s}>
                {labels.statuses[s]}
              </option>
            ))}
          </select>
        </label>
        <Input id={`${id}-starts`} name="starts_on" type="date" label={labels.starts} defaultValue={stop?.starts_on ?? ""} optional={labels.optional} />
        <Input id={`${id}-ends`} name="ends_on" type="date" label={labels.ends} defaultValue={stop?.ends_on ?? ""} optional={labels.optional} invalid={bad("ends_on")} />
      </div>
      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="is_home" className="h-4 w-4" defaultChecked={stop?.is_home} />
        {labels.home}
      </label>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`text-[0.9rem] ${state.ok ? "text-verdigris" : "text-oxblood"}`}>
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {labels.save}
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
            {labels.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

function Input(props: { id: string; name: string; label: string; defaultValue?: string; type?: string; required?: boolean; optional?: string; invalid?: boolean }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={props.id} className="t-label">
        {props.label} {props.optional && <span className="text-ash-dim">({props.optional})</span>}
      </label>
      <input id={props.id} name={props.name} type={props.type ?? "text"} defaultValue={props.defaultValue} required={props.required} className="input" aria-invalid={props.invalid} maxLength={200} />
    </div>
  );
}

export function CityRow({ stop, labels, timezones, waitlistLabel, dates }: { stop: TourStop; labels: Labels; timezones: string[]; waitlistLabel: string | null; dates: string }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  if (editing) return <CityForm stop={stop} labels={labels} timezones={timezones} onDone={() => setEditing(false)} />;
  return (
    <div className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="font-serif text-[1.45rem] leading-tight">
          {stop.city}
          {stop.country && <span className="text-ash">, {stop.country}</span>}
        </p>
        <p className="mt-1 text-[0.9rem] text-ash">{[stop.studio_name, stop.is_home ? labels.home : dates, stop.timezone.replace(/_/g, " ")].filter(Boolean).join(", ")}</p>
        {waitlistLabel && <p className="mt-1 text-[0.9rem] text-gilt">{waitlistLabel}</p>}
        {note && (
          <p role="status" className="mt-1 text-[0.9rem] text-verdigris">
            {note}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className={`pill ${stop.status === "booking" ? "text-verdigris" : stop.status === "full" ? "text-ember" : "text-ash"}`}>{labels.statuses[stop.status]}</span>
        {waitlistLabel && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => setNote((await notifyWaitlist(stop.id)).message))}>
            {labels.notify}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          {labels.edit}
        </button>
        {confirm ? (
          <>
            <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => start(() => deleteStop(stop.id))}>
              {labels.delete}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>
              {labels.cancel}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm text-oxblood" onClick={() => setConfirm(true)}>
            {labels.delete}
          </button>
        )}
      </div>
    </div>
  );
}

export function AddCity({ labels, timezones }: { labels: Labels; timezones: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn btn-primary w-fit" onClick={() => setOpen(true)}>
        {labels.add}
      </button>
    );
  return <CityForm labels={labels} timezones={timezones} onDone={() => setOpen(false)} />;
}
