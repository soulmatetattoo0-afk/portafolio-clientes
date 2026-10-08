"use client";

import { useActionState } from "react";

import { useSubmit } from "@/components/useSubmit";

import { sendClientLink, signInWithProvider, type SignInState } from "./actions";

interface Labels {
  email: string;
  send: string;
  google: string;
  apple: string;
  or: string;
}

const EMPTY: SignInState = { sent: null, error: null };

/** Live sign-in: the two providers, then the magic link. One error slot for each form. */
export function SignInForm({ next, labels }: { next: string; labels: Labels }) {
  const [link, sendLink, linkPending] = useActionState<SignInState, FormData>(sendClientLink, EMPTY);
  const [oauth, startOauth, oauthPending] = useActionState<SignInState, FormData>(signInWithProvider, EMPTY);
  const submitLink = useSubmit(sendLink);
  const submitOauth = useSubmit(startOauth);

  if (link.sent) {
    return (
      <p role="status" className="p-quote text-[1.5rem] text-bone">
        {link.sent}
      </p>
    );
  }
  return (
    <div className="grid gap-7">
      <form onSubmit={submitOauth} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        <button type="submit" name="provider" value="google" className="btn btn-secondary w-full" aria-busy={oauthPending}>
          {labels.google}
        </button>
        <button type="submit" name="provider" value="apple" className="btn btn-secondary w-full" aria-busy={oauthPending}>
          {labels.apple}
        </button>
        <p role="alert" className={`text-[0.88rem] text-ember ${oauth.error ? "" : "hidden"}`}>
          {oauth.error}
        </p>
      </form>
      <p className="p-stamp text-bone-dim">{labels.or}</p>
      <form onSubmit={submitLink} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="me-email" className="p-stamp text-bone-dim">
          {labels.email}
        </label>
        <input id="me-email" name="email" type="email" inputMode="email" autoComplete="email" required className="input" aria-invalid={Boolean(link.error)} aria-describedby="me-email-error" />
        <p id="me-email-error" role="alert" className={`text-[0.88rem] text-ember ${link.error ? "" : "hidden"}`}>
          {link.error}
        </p>
        <button type="submit" className="btn btn-primary mt-1 w-full" aria-busy={linkPending}>
          {labels.send}
        </button>
      </form>
    </div>
  );
}
