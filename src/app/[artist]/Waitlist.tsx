"use client";

import { useActionState, useId, useState } from "react";

import { joinWaitlist, type WaitlistState } from "./actions";
import { useSubmit } from "@/components/useSubmit";

export function Waitlist(props: { artistId: string; stopId: string; city: string; labels: { notify: string; title: string; email: string; join: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, { ok: false, message: null });
  const onSubmit = useSubmit(action);
  const id = useId();
  if (state.ok) return <p className="text-sm text-verdigris" role="status">{state.message}</p>;
  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        {props.labels.notify}
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid w-full gap-2 sm:max-w-md">
      <input type="hidden" name="artistId" value={props.artistId} />
      <input type="hidden" name="stopId" value={props.stopId} />
      <label htmlFor={id} className="t-label">
        {props.labels.title}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={id} name="email" type="email" autoComplete="email" required className="input" placeholder="name@example.com" aria-describedby={`${id}-msg`} />
        <button type="submit" className="btn btn-primary btn-sm shrink-0" disabled={pending}>
          {props.labels.join}
        </button>
      </div>
      <p id={`${id}-msg`} className="min-h-5 text-sm text-oxblood" role="alert">
        {state.message}
      </p>
    </form>
  );
}
