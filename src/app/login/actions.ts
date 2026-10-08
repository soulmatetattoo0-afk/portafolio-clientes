"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { setDevSession, signOut, supabaseServer } from "@/lib/auth";
import { DEMO_EMAIL, DEMO_USER_ID, env, live } from "@/lib/env";
import { allow } from "@/lib/ratelimit";

export interface LoginState {
  sent: string | null;
  error: string | null;
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const t = dict(await getLocale());
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { sent: null, error: t.brief.contact.emailInvalid };
  if (!live.auth) return { sent: null, error: t.studio.login.noAccount };
  if (!(await allow("login", 5, 900))) return { sent: null, error: t.common.error };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${env.appUrl}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { sent: null, error: t.common.error };
  return { sent: fill(t.studio.login.sent, { email: email.data }), error: null };
}

/** Local mode only: sign in as the seeded demo artist. */
export async function enterDemo() {
  if (live.auth) redirect("/login");
  await setDevSession(DEMO_USER_ID, DEMO_EMAIL);
  redirect("/studio");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
