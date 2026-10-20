import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import { getDb } from "./db";
import { DEMO_CLIENT_EMAIL, DEMO_CLIENT_USER_ID, DEMO_EMAIL, DEMO_USER_ID, env, live } from "./env";
import { sign, verify } from "./util";

export interface Session {
  userId: string;
  email: string;
  /** The email is proven (confirmed with Supabase, or local mode). Only a proven email may claim a page made for it. */
  verified?: boolean;
  /** Local mode: nobody signed in; this is the stand-in demo client. The artists' door still opens. */
  implicit?: boolean;
}

export interface Member extends Session {
  studioId: string;
  artistId: string;
  role: "owner" | "artist" | "assistant";
  /** The studio's tier (see lib/plan.ts); what the artist may do follows from it. */
  plan: string;
}

const DEV_COOKIE = "dev_session";
/** Local mode: set after "sign out", so the visitor stays signed out instead of becoming the demo client again. */
const DEV_OUT_COOKIE = "dev_signed_out";
export { DEMO_USER_ID };

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Who is signed in, asked once per request however many parts of the page want to know. */
export const getSession = cache(readSession);

async function readSession(): Promise<Session | null> {
  if (live.auth) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user ? { userId: data.user.id, email: data.user.email ?? "", verified: Boolean(data.user.email_confirmed_at) } : null;
  }
  const store = await cookies();
  const raw = store.get(DEV_COOKIE)?.value;
  // Local mode and previews: a visitor is the demo client (Daniel Reyes) until they sign in as someone else
  // or sign out, so the client's side can be tried without making an account every time.
  if (!raw) return store.get(DEV_OUT_COOKIE) ? null : { userId: DEMO_CLIENT_USER_ID, email: DEMO_CLIENT_EMAIL, verified: true, implicit: true };
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !verify(payload, sig)) return null;
  const [userId, email] = Buffer.from(payload, "base64url").toString().split("|");
  return userId ? { userId, email: email ?? "", verified: true } : null;
}

/** Local mode only: sign in as a member without email. */
export async function setDevSession(userId: string, email: string) {
  const payload = Buffer.from(`${userId}|${email}`).toString("base64url");
  const store = await cookies();
  store.delete(DEV_OUT_COOKIE);
  store.set(DEV_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signOut() {
  if (live.auth) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  const store = await cookies();
  store.delete(DEV_COOKIE);
  if (!live.auth) store.set(DEV_OUT_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

/** The signed-in artist's membership, or null if they haven't created a page yet. */
export async function getMember(session?: Session | null): Promise<Member | null> {
  const s = session ?? (await getSession());
  if (!s) return null;
  const db = await getDb();
  // A page the house set up for an artist (TATTOO BY SOVA) waits under their email: the first verified account with it takes it over.
  if (s.verified && s.email) {
    await db.query(
      `update members set user_id = $1 where lower(email) = lower($2) and user_id <> $1 and not exists (select 1 from members where user_id = $1)`,
      [s.userId, s.email],
    );
  }
  const row = await db.one<{ studio_id: string; artist_id: string | null; role: Member["role"]; plan: string }>(
    `select m.studio_id, coalesce(m.artist_id, (select a.id from artists a where a.studio_id = m.studio_id order by a.created_at limit 1)) as artist_id, m.role, st.plan
       from members m join studios st on st.id = m.studio_id where m.user_id = $1 order by m.created_at limit 1`,
    [s.userId],
  );
  if (!row?.artist_id) return null;
  return { ...s, studioId: row.studio_id, artistId: row.artist_id, role: row.role, plan: row.plan };
}

/** Gate for every studio page and action: signed in, with a page. Asked once per request. */
export const requireMember = cache(resolveMember);

async function resolveMember(): Promise<Member> {
  const session = await getSession();
  // Local mode and previews: the studio always opens as the demo artist (Camo), no sign-in needed.
  if (!live.auth && (!session || session.implicit)) {
    const demo = await getMember({ userId: DEMO_USER_ID, email: DEMO_EMAIL, verified: true });
    if (demo) return demo;
  }
  if (!session) redirect("/login");
  const member = await getMember(session);
  if (!member) {
    if (!live.auth) {
      const demo = await getMember({ userId: DEMO_USER_ID, email: DEMO_EMAIL, verified: true });
      if (demo) return demo;
    }
    redirect("/studio/onboarding");
  }
  return member;
}

/** Whether this session may open the house desk (/admin): a listed admin email, or the demo member in local mode. */
export function isAdmin(session: Session | null): boolean {
  if (!session) return false;
  const email = session.email.toLowerCase();
  if (env.adminEmails.includes(email)) return true;
  return !live.auth && email === DEMO_EMAIL.toLowerCase();
}

/** Gate for every admin page and action. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/login");
  return session!;
}
