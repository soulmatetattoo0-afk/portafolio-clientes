"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession, setDevSession, supabaseServer } from "@/lib/auth";
import { ensureClientUser, safeNext } from "@/lib/client";
import { getDb } from "@/lib/db";
import { checkPassword, hashPassword } from "@/lib/password";
import { DEMO_CLIENT_EMAIL, DEMO_CLIENT_USER_ID, env, live } from "@/lib/env";
import { allow } from "@/lib/ratelimit";

/** Where Supabase sends people back after an email link (confirming the account, a password reset). */
const callback = (next: string) => `${env.appUrl}/auth/callback?intent=client&next=${encodeURIComponent(next)}`;

/** Local mode only: sign in as the seeded demo client. */
export async function enterDemoClient(form: FormData) {
  const next = safeNext(form.get("next"));
  if (live.auth) redirect(`/me/signin?next=${encodeURIComponent(next)}`);
  await setDevSession(DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL);
  await ensureClientUser(DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL, await getLocale());
  redirect(next);
}

export interface AccountState {
  error: string | null;
  sent: string | null;
}

const Username = z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,24}$/);
const Password = z.string().min(8).max(200);

/** A free username from the email: "Soulmate.Tattoo0@gmail.com" → "soulmate.tattoo0", with a number if taken. */
async function usernameFromEmail(email: string) {
  const base = (email.split("@")[0] ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20)
    .padEnd(3, "0");
  const db = await getDb();
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base.slice(0, 20)}${n + 1}`;
    if (!(await db.one(`select 1 from client_users where lower(username) = $1`, [candidate]))) return candidate;
  }
  return `${base.slice(0, 16)}${Date.now() % 100000}`;
}

/**
 * Create an account. Clients pick a username (it is the name the artist sees);
 * artists only give an email and a password, their name comes next, in
 * "¿Cómo te conocen?", and the username is made from the email.
 */
export async function signUpClient(_prev: AccountState, form: FormData): Promise<AccountState> {
  const locale = await getLocale();
  const t = dict(locale).me.account;
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  const typed = form.get("username");
  const username = Username.safeParse(typed === null && email.success ? await usernameFromEmail(email.data) : typed);
  const password = Password.safeParse(form.get("password"));
  const next = safeNext(form.get("next"));
  if (!username.success) return { error: t.usernameInvalid, sent: null };
  if (!email.success) return { error: t.emailInvalid, sent: null };
  if (!password.success) return { error: t.passwordShort, sent: null };
  if (!(await allow("signup", 10, 3600))) return { error: t.tryLater, sent: null };
  const db = await getDb();
  const taken = await db.one<{ username: string | null; email: string }>(`select username, email from client_users where lower(username) = $1 or lower(email) = $2`, [username.data, email.data]);
  if (taken) return { error: taken.email.toLowerCase() === email.data ? t.emailTaken : t.usernameTaken, sent: null };

  if (live.auth) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({ email: email.data, password: password.data, options: { emailRedirectTo: callback(next), data: { username: username.data } } });
    if (error || !data.user) return { error: t.failed, sent: null };
    await ensureClientUser(data.user.id, email.data, locale);
    await db.query(`update client_users set username = $2, name = coalesce(name, $2) where user_id = $1`, [data.user.id, username.data]);
    // With email confirmation on, Supabase returns no session until the link is opened.
    if (!data.session) return { error: null, sent: fill(t.confirm, { email: email.data }) };
    redirect(next);
  }
  const userId = randomUUID();
  await db.query(`insert into client_users (user_id, email, name, username, locale, password_hash) values ($1, $2, $3, $3, $4, $5)`, [
    userId, email.data, username.data, locale, await hashPassword(password.data),
  ]);
  await ensureClientUser(userId, email.data, locale);
  await setDevSession(userId, email.data);
  redirect(next);
}

/** Sign in with a username or an email, and the password. */
export async function signInClient(_prev: AccountState, form: FormData): Promise<AccountState> {
  const t = dict(await getLocale()).me.account;
  const who = String(form.get("who") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!who || !password) return { error: t.wrong, sent: null };
  if (!(await allow("signin", 10, 900))) return { error: t.tryLater, sent: null };
  const db = await getDb();
  const row = await db.one<{ user_id: string; email: string; password_hash: string | null }>(
    `select user_id, email, password_hash from client_users where lower(username) = $1 or lower(email) = $1`,
    [who],
  );
  if (live.auth) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email: row?.email ?? who, password });
    if (error || !data.user) return { error: t.wrong, sent: null };
    await ensureClientUser(data.user.id, data.user.email ?? row?.email ?? who, await getLocale());
    redirect(next);
  }
  if (!row || !(await checkPassword(password, row.password_hash))) return { error: t.wrong, sent: null };
  await setDevSession(row.user_id, row.email);
  redirect(next);
}

/** A new password for whoever is signed in: after a reset link, or from their settings. */
export async function changePassword(_prev: AccountState, form: FormData): Promise<AccountState> {
  const locale = await getLocale();
  const t = dict(locale).me.account;
  const session = await getSession();
  if (!session) return { error: t.failed, sent: null };
  const password = Password.safeParse(form.get("password"));
  if (!password.success) return { error: t.passwordShort, sent: null };
  if (password.data !== form.get("confirm")) return { error: t.mismatch, sent: null };
  if (!(await allow("password", 10, 3600))) return { error: t.tryLater, sent: null };
  if (live.auth) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({ password: password.data });
    if (error) return { error: t.failed, sent: null };
    return { error: null, sent: t.passwordSaved };
  }
  // Local accounts keep their hash on the account row; a seeded page's owner gets one on first change.
  await ensureClientUser(session.userId, session.email, locale);
  const db = await getDb();
  await db.query(`update client_users set password_hash = $2 where user_id = $1`, [session.userId, await hashPassword(password.data)]);
  return { error: null, sent: t.passwordSaved };
}

/** Forgotten password: a link to the account's email that signs in and opens the new-password page. */
export async function requestPasswordReset(_prev: AccountState, form: FormData): Promise<AccountState> {
  const t = dict(await getLocale()).me.account;
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { error: t.emailInvalid, sent: null };
  if (!live.auth) return { error: t.forgotLocal, sent: null };
  if (!(await allow("reset", 5, 3600))) return { error: t.tryLater, sent: null };
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: callback("/account/password") });
  // The same answer whether or not the account exists.
  return { error: null, sent: t.forgotSent };
}
