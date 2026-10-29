import { getMember, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * A chat's heartbeat: how many things have happened in it and when the last
 * one did. The open chat asks every few seconds and only reloads when this
 * changes, so a new message shows without anyone leaving the page.
 * The client asks with their private chat link (?t=), the artist with the
 * request id (?b=), checked against their studio.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const brief = url.searchParams.get("b");
  const db = await getDb();
  let row: { n: number; last: string | null } | null = null;
  if (token && /^[a-f0-9]{20,}$/.test(token)) {
    row = await db.one(
      `select count(*)::int as n, max(e.created_at)::text as last from brief_events e join briefs b on b.id = e.brief_id where b.chat_token = $1`,
      [token],
    );
  } else if (brief && /^[0-9a-f-]{36}$/.test(brief)) {
    const member = await getMember(await getSession());
    if (!member) return new Response(null, { status: 401 });
    row = await db.one(
      `select count(*)::int as n, max(e.created_at)::text as last from brief_events e join briefs b on b.id = e.brief_id where b.id = $1 and b.studio_id = $2`,
      [brief, member.studioId],
    );
  } else return new Response(null, { status: 400 });
  return Response.json({ v: row ? `${row.n}:${row.last ?? ""}` : "" }, { headers: { "cache-control": "no-store" } });
}
