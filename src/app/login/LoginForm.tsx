"use client";

import { useActionState } from "react";

import { sendMagicLink, type LoginState } from "./actions";
import { useSubmit } from "@/components/useSubmit";

export function LoginForm({ labels }: { labels: { email: string; send: string } }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { sent: null, error: null });
  const onSubmit = useSubmit(action);
  if (state.sent) {
    return (
      <p className="font-serif text-[1.35rem] leading-snug" role="status">
        {state.sent}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label htmlFor="login-email" className="t-label">
        {labels.email}
      </label>
      <input id="login-email" name="email" type="email" autoComplete="email" required className="input" aria-invalid={Boolean(state.error)} aria-describedby="login-error" />
      <p id="login-error" role="alert" className={`text-[0.88rem] text-oxblood ${state.error ? "" : "hidden"}`}>
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary mt-1" disabled={pending}>
        {labels.send}
      </button>
    </form>
  );
}
