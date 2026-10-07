"use client";

import { useActionState, useId } from "react";

import { useSubmit } from "@/components/useSubmit";

import { requestCity, type WaitlistState } from "./actions";

/** "Ask me to come": a fan names their city and leaves an email. */
export function CityRequest({ artistId, labels }: { artistId: string; labels: { city: string; email: string; send: string } }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(requestCity, { ok: false, message: null });
  const onSubmit = useSubmit(action);
  const id = useId();
  if (state.ok)
    return (
      <p className="p-quote text-[1.3rem] text-accent" role="status">
        {state.message}
      </p>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="artistId" value={artistId} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor={`${id}-city`}>
          {labels.city}
        </label>
        <input id={`${id}-city`} name="city" className="input" placeholder={labels.city} maxLength={80} required autoComplete="address-level2" />
        <label className="sr-only" htmlFor={`${id}-email`}>
          {labels.email}
        </label>
        <input id={`${id}-email`} name="email" type="email" className="input" placeholder={labels.email} maxLength={200} required autoComplete="email" />
        <button type="submit" className="btn btn-accent" disabled={pending}>
          {labels.send}
        </button>
      </div>
      <p className="min-h-5 text-[0.88rem] text-oxblood" role="alert">
        {state.message}
      </p>
    </form>
  );
}
