"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";

import { useSubmit } from "@/components/useSubmit";
import { fill } from "@/i18n";

import { deleteAccount, saveProfile, signOutClient, type FormState } from "../actions";

const IDLE: FormState = { ok: false, error: null };

interface ProfileLabels {
  name: string;
  email: string;
  emailHint: string;
  language: string;
  en: string;
  es: string;
  homeCity: string;
  homeCityHint: string;
  save: string;
  saved: string;
}

export function ProfileForm({ me, labels }: { me: { name: string; email: string; locale: "en" | "es"; homeCity: string }; labels: ProfileLabels }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, IDLE);
  const onSubmit = useSubmit(action);
  const router = useRouter();
  const id = useId();
  // A language change re-renders the whole page in the new one.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor={`${id}-name`} className="p-stamp text-bone-dim">
          {labels.name}
        </label>
        <input id={`${id}-name`} name="name" className="input" defaultValue={me.name} autoComplete="name" maxLength={120} required aria-invalid={Boolean(state.error)} aria-describedby={`${id}-err`} />
      </div>
      <div className="grid gap-2">
        <label htmlFor={`${id}-email`} className="p-stamp text-bone-dim">
          {labels.email}
        </label>
        <input id={`${id}-email`} className="input opacity-70" value={me.email} readOnly aria-describedby={`${id}-email-hint`} />
        <p id={`${id}-email-hint`} className="text-[0.85rem] text-bone-dim">
          {labels.emailHint}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={`${id}-locale`} className="p-stamp text-bone-dim">
            {labels.language}
          </label>
          <select id={`${id}-locale`} name="locale" className="input" defaultValue={me.locale}>
            <option value="en">{labels.en}</option>
            <option value="es">{labels.es}</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-city`} className="p-stamp text-bone-dim">
            {labels.homeCity}
          </label>
          <input id={`${id}-city`} name="homeCity" className="input" defaultValue={me.homeCity} autoComplete="address-level2" maxLength={120} aria-describedby={`${id}-city-hint`} />
          <p id={`${id}-city-hint`} className="text-[0.85rem] text-bone-dim">
            {labels.homeCityHint}
          </p>
        </div>
      </div>
      <p id={`${id}-err`} role="alert" className={`text-[0.9rem] text-ember ${state.error ? "" : "hidden"}`}>
        {state.error}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" aria-busy={pending}>
          {labels.save}
        </button>
        {state.ok && (
          <p role="status" className="text-[0.9rem] text-accent">
            {labels.saved}
          </p>
        )}
      </div>
    </form>
  );
}

export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOutClient}>
      <button type="submit" className="btn btn-secondary">
        {label}
      </button>
    </form>
  );
}

/** Deleting asks for the person's name, typed, on the page itself: no browser dialog. */
export function DeleteAccount({ expected, labels }: { expected: string; labels: { confirmLabel: string; delete: string; danger: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, IDLE);
  const onSubmit = useSubmit(action);
  const [typed, setTyped] = useState("");
  const id = useId();
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label htmlFor={`${id}-confirm`} className="p-stamp text-bone-dim">
        {fill(labels.confirmLabel, { name: expected })}
      </label>
      <input id={`${id}-confirm`} name="confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-invalid={Boolean(state.error)} aria-describedby={`${id}-err`} />
      <p id={`${id}-err`} role="alert" className={`text-[0.9rem] text-ember ${state.error ? "" : "hidden"}`}>
        {state.error}
      </p>
      <button type="submit" className="btn btn-danger justify-self-start" aria-busy={pending}>
        {labels.delete}
      </button>
    </form>
  );
}
