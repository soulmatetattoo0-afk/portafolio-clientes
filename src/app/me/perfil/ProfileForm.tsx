"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/me/actions";

/** Name, email (read-only), language and city, saved in one go. */
export function ProfileForm({ me, labels, action }: { me: { name: string; email: string; locale: "en" | "es"; homeCity: string }; labels: { name: string; email: string; language: string; city: string; save: string; saved: string; es: string; en: string }; action: (prev: FormState, form: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, { ok: false, error: null });
  return (
    <form action={formAction} className="v2-sheet mt-2 grid gap-3 p-4">
      <label className="v2-field">
        <span>{labels.name}</span>
        <input name="name" className="v2-input" defaultValue={me.name} maxLength={120} required />
      </label>
      <label className="v2-field">
        <span>{labels.email}</span>
        <input className="v2-input opacity-70" value={me.email} readOnly />
      </label>
      <label className="v2-field">
        <span>{labels.city}</span>
        <input name="homeCity" className="v2-input" defaultValue={me.homeCity} maxLength={80} />
      </label>
      <label className="v2-field">
        <span>{labels.language}</span>
        <select name="locale" className="v2-input" defaultValue={me.locale}>
          <option value="es">{labels.es}</option>
          <option value="en">{labels.en}</option>
        </select>
      </label>
      {state.error && (
        <p role="alert" className="text-[0.88rem] text-accent">
          {state.error}
        </p>
      )}
      <button type="submit" className="v2-btn justify-self-start" data-tone="accent" disabled={pending}>
        {state.ok ? labels.saved : labels.save}
      </button>
    </form>
  );
}
