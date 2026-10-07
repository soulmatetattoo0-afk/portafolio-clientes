import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import { getDb } from "./db";
import { DEMO_USER_ID, env, live } from "./env";
import { sign, verify } from "./util";

export interface Session {
  userId: string;
  email: string;
}

export interface Member extends Session {
  studioId: string;
  artistId: string;
  role: "owner" | "artist" | "assistant";
}

const DEV_COOKIE = "dev_session";
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

export async function getSession(): Promise<Session | null> {
  if (live.auth) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user ? { userId: data.user.id, email: data.user.email ?? "" } : null;
  }
  const raw = (await cookies()).get(DEV_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !verify(payload, sig)) return null;
  const [userId, email] = Buffer.from(payload, "base64url").toString().split("|");
  return userId ? { userId, email: email ?? "" } : null;
}

/** Local mode only: sign in as a member without email. */
export async function setDevSession(userId: string, email: string) {
  const payload = Buffer.from(`${userId}|${email}`).toString("base64url");
  (await cookies()).set(DEV_COOKIE, `${payload}.${sign(payload)}`, {
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
  (await cookies()).delete(DEV_COOKIE);
}

/** The signed-in artist's membership, or null if they haven't created a page yet. */
export async function getMember(session?: Session | null): Promise<Member | null> {
  const s = session ?? (await getSession());
  if (!s) return null;
  const db = await getDb();
  const row = await db.one<{ studio_id: string; artist_id: string | null; role: Member["role"] }>(
    `select m.studio_id, coalesce(m.artist_id, (select a.id from artists a where a.studio_id = m.studio_id order by a.created_at limit 1)) as artist_id, m.role
       from members m where m.user_id = $1 order by m.created_at limit 1`,
    [s.userId],
  );
  if (!row?.artist_id) return null;
  return { ...s, studioId: row.studio_id, artistId: row.artist_id, role: row.role };
}

/** Gate for every studio page and action: signed in, with a page. */
export async function requireMember(): Promise<Member> {
  const session = await getSession();
  if (!session) redirect("/login");
  const member = await getMember(session);
  if (!member) redirect("/studio/onboarding");
  return member;
}
