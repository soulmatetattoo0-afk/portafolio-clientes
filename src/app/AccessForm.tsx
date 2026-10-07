"use client";

import { useActionState } from "react";

import { requestAccess, type LeadState } from "./actions/leads";
import { useSubmit } from "@/components/useSubmit";

export function AccessForm({ labels }: { labels: { email: string; instagram: string; city: string; submit: string; done: string; optional: string } }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(requestAccess, { ok: false, error: null });
  const onSubmit = useSubmit(action);
  if (state.ok) {
    return (
      <p className="font-serif text-[1.4rem] leading-snug" role="status">
        {labels.done}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <label htmlFor="lead-email" className="t-label">
          {labels.email}
        </label>
        <input id="lead-email" name="email" type="email" autoComplete="email" required className="input" aria-invalid={Boolean(state.error)} aria-describedby="lead-error" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="lead-ig" className="t-label">
          {labels.instagram} <span className="text-ash-dim">({labels.optional})</span>
        </label>
        <input id="lead-ig" name="instagram" autoComplete="off" className="input" placeholder="@" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="lead-city" className="t-label">
          {labels.city} <span className="text-ash-dim">({labels.optional})</span>
        </label>
        <input id="lead-city" name="city" autoComplete="address-level2" className="input" />
      </div>
      <p id="lead-error" role="alert" className="min-h-5 text-sm text-oxblood sm:col-span-2">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary sm:w-fit" disabled={pending}>
        {labels.submit}
      </button>
    </form>
  );
}
