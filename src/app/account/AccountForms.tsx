"use client";

import { useActionState } from "react";

import { useSubmit } from "@/components/useSubmit";

import { changePassword, requestPasswordReset, type AccountState } from "../me/signin/actions";

const EMPTY: AccountState = { error: null, sent: null };

function Done({ text }: { text: string }) {
  return (
    <p role="status" className="p-quote text-[1.35rem] text-bone">
      {text}
    </p>
  );
}

function Problem({ text }: { text: string | null }) {
  return (
    <p role="alert" className={`text-[0.88rem] text-ember ${text ? "" : "hidden"}`}>
      {text}
    </p>
  );
}

/** A new password, typed twice. */
export function PasswordForm({ labels }: { labels: { password: string; confirm: string; hint: string; save: string } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, EMPTY);
  const onSubmit = useSubmit(action);
  if (state.sent) return <Done text={state.sent} />;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone-dim">{labels.password}</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
        <span className="text-[0.8rem] text-bone-dim">{labels.hint}</span>
      </label>
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone-dim">{labels.confirm}</span>
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className="input" />
      </label>
      <Problem text={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-busy={pending}>
        {labels.save}
      </button>
    </form>
  );
}

/** The account's email, for a link that lets them set a new password. */
export function ForgotForm({ labels }: { labels: { email: string; send: string } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(requestPasswordReset, EMPTY);
  const onSubmit = useSubmit(action);
  if (state.sent) return <Done text={state.sent} />;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="p-stamp text-bone-dim">{labels.email}</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className="input" />
      </label>
      <Problem text={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-busy={pending}>
        {labels.send}
      </button>
    </form>
  );
}
