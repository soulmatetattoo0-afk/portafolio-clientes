"use client";

import { useActionState, useState } from "react";

import { useSubmit } from "@/components/useSubmit";

import { signInClient, signUpClient, type AccountState } from "./actions";

export interface AccountLabels {
  create: string;
  enter: string;
  username: string;
  usernameHint: string;
  email: string;
  password: string;
  passwordHint: string;
  who: string;
  submitCreate: string;
  submitEnter: string;
}

const EMPTY: AccountState = { error: null, sent: null };

/** The account: create one (username, email, password) or sign in with it. */
export function AccountForm({ next, labels, initial = "create" }: { next: string; labels: AccountLabels; initial?: "create" | "enter" }) {
  const [mode, setMode] = useState<"create" | "enter">(initial);
  const [up, signUp, upPending] = useActionState<AccountState, FormData>(signUpClient, EMPTY);
  const [inn, signIn, inPending] = useActionState<AccountState, FormData>(signInClient, EMPTY);
  const submitUp = useSubmit(signUp);
  const submitIn = useSubmit(signIn);
  const state = mode === "create" ? up : inn;

  if (up.sent) {
    return (
      <p role="status" className="p-quote text-[1.4rem] text-bone">
        {up.sent}
      </p>
    );
  }
  return (
    <div className="grid gap-5">
      <div className="seg w-full">
        {(["create", "enter"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} className="flex-1" onClick={() => setMode(m)}>
            {m === "create" ? labels.create : labels.enter}
          </button>
        ))}
      </div>
      {mode === "create" ? (
        <form onSubmit={submitUp} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="acc-username" label={labels.username} hint={labels.usernameHint}>
            <input id="acc-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24} pattern="[A-Za-z0-9._]{3,24}" className="input" />
          </Field>
          <Field id="acc-email" label={labels.email}>
            <input id="acc-email" name="email" type="email" inputMode="email" autoComplete="email" required className="input" />
          </Field>
          <Field id="acc-password" label={labels.password} hint={labels.passwordHint}>
            <input id="acc-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
          </Field>
          <Error message={state.error} />
          <button type="submit" className="btn btn-primary w-full" aria-busy={upPending} disabled={upPending}>
            {labels.submitCreate}
          </button>
        </form>
      ) : (
        <form onSubmit={submitIn} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="acc-who" label={labels.who}>
            <input id="acc-who" name="who" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="input" />
          </Field>
          <Field id="acc-pass" label={labels.password}>
            <input id="acc-pass" name="password" type="password" autoComplete="current-password" required className="input" />
          </Field>
          <Error message={state.error} />
          <button type="submit" className="btn btn-primary w-full" aria-busy={inPending} disabled={inPending}>
            {labels.submitEnter}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="p-stamp text-bone-dim">
        {label}
      </label>
      {children}
      {hint && <p className="text-[0.8rem] text-bone-dim">{hint}</p>}
    </div>
  );
}

function Error({ message }: { message: string | null }) {
  return (
    <p role="alert" className={`text-[0.88rem] text-ember ${message ? "" : "hidden"}`}>
      {message}
    </p>
  );
}
