import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** The open app says "I'm here" every ~40 s; chat emails skip whoever was here in the last two minutes. */
export async function POST() {
  const session = await getSession();
  if (!session || session.implicit) return new Response(null, { status: 204 });
  const db = await getDb();
  await Promise.all([
    db.query(`update client_users set last_seen_at = now() where user_id = $1`, [session.userId]),
    db.query(`update members set last_seen_at = now() where user_id = $1`, [session.userId]),
  ]);
  return new Response(null, { status: 204 });
}
