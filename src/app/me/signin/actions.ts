"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { setDevSession, supabaseServer } from "@/lib/auth";
import { ensureClientUser, safeNext } from "@/lib/client";
import { DEMO_CLIENT_EMAIL, DEMO_CLIENT_USER_ID, env, live } from "@/lib/env";
import { allow } from "@/lib/ratelimit";

export interface SignInState {
  sent: string | null;
  error: string | null;
}

const callback = (next: string) => `${env.appUrl}/auth/callback?intent=client&next=${encodeURIComponent(next)}`;

/** Live auth: a magic link that lands on the callback with the client intent. */
export async function sendClientLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const t = dict(await getLocale());
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { sent: null, error: t.brief.contact.emailInvalid };
  if (!live.auth) return { sent: null, error: t.common.error };
  if (!(await allow("client-login", 5, 900))) return { sent: null, error: t.common.error };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callback(safeNext(form.get("next"))), shouldCreateUser: true },
  });
  if (error) return { sent: null, error: t.common.error };
  return { sent: fill(t.me.signin.sent, { email: email.data }), error: null };
}

/** Live auth: hand off to Google or Apple; a provider that isn't switched on shows a plain message. */
export async function signInWithProvider(_prev: SignInState, form: FormData): Promise<SignInState> {
  const t = dict(await getLocale());
  const provider = form.get("provider") === "apple" ? "apple" : "google";
  if (!live.auth) return { sent: null, error: t.common.error };
  if (!(await allow("client-login", 10, 900))) return { sent: null, error: t.common.error };
  let url: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback(safeNext(form.get("next"))) } });
    if (error || !data.url) return { sent: null, error: t.me.signin.providerOff };
    url = data.url;
  } catch {
    return { sent: null, error: t.me.signin.providerOff };
  }
  redirect(url);
}

/** Local mode only: sign in as the seeded demo client. */
export async function enterDemoClient(form: FormData) {
  const next = safeNext(form.get("next"));
  if (live.auth) redirect(`/me/signin?next=${encodeURIComponent(next)}`);
  await setDevSession(DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL);
  await ensureClientUser(DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL, await getLocale());
  redirect(next);
}
