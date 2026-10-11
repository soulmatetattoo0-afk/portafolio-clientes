"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { chatToArtist } from "@/lib/messages";
import { notify } from "@/lib/push";
import { allow } from "@/lib/ratelimit";

const Body = z.string().trim().min(1).max(3000);

/** The client writes to the artist. The private link is the key; nothing else is asked. */
export async function sendClientMessage(chatToken: string, text: string): Promise<{ error?: string } | void> {
  const t = dict(await getLocale());
  const body = Body.safeParse(text);
  if (!body.success || !/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return { error: t.common.error };
  if (!(await allow(`chat:${chatToken}`, 30, 3600))) return { error: t.common.error };
  const db = await getDb();
  const b = await db.one<{ id: string; studio_id: string; status: string; client_name: string; artist_name: string; owner_email: string | null; owner_locale: "en" | "es" | null }>(
    `select b.id, b.studio_id, b.status, c.name as client_name, a.display_name as artist_name,
            (select m.email from members m where m.studio_id = b.studio_id order by (m.role = 'owner') desc limit 1) as owner_email,
            (select m.locale from members m where m.studio_id = b.studio_id order by (m.role = 'owner') desc limit 1) as owner_locale
       from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id where b.chat_token = $1`,
    [chatToken],
  );
  if (!b || b.status === "archived") return { error: t.common.error };
  // The conversation opens for the client once the artist has answered the request.
  const answered = await db.one(`select 1 from brief_events where brief_id = $1 and actor = 'artist' limit 1`, [b.id]);
  if (!answered) return { error: t.common.error };
  // Did the artist already have something unread from this client? Then one email is enough.
  const unread = await db.one(
    `select 1 from brief_events e join briefs b on b.id = e.brief_id
      where e.brief_id = $1 and e.actor = 'client' and e.kind = 'message' and e.created_at > coalesce(b.artist_read_at, b.created_at)`,
    [b.id],
  );
  await db.tx(async (tx) => {
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'message', 'client', $3)`, [b.studio_id, b.id, body.data]);
    await tx.query(`update briefs set client_read_at = now(), updated_at = now(), status = case when status = 'needs_info' then 'new' else status end where id = $1`, [b.id]);
  });
  // The artist hears on their phone, every message (one notification per conversation, replaced as it grows).
  const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [b.studio_id]);
  after(() => notify(members.map((m) => m.user_id), { title: fill(dict(members[0]?.locale ?? "en").push.newMessageFrom, { name: b.client_name }), body: body.data, url: `/studio?brief=${b.id}`, tag: `chat:${b.id}` }));
  if (!unread && b.owner_email) {
    await enqueueEmail(db, chatToArtist({ to: b.owner_email, client: b.client_name, artist: b.artist_name, message: body.data, briefId: b.id, locale: b.owner_locale ?? "en" }), {
      studioId: b.studio_id,
      template: "chat_artist",
    });
    after(async () => {
      await flushOutbox(await getDb());
    });
  }
  revalidatePath(`/c/${chatToken}`);
}

/** Opening the conversation marks it read for the client. */
export async function markClientRead(chatToken: string) {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return;
  const db = await getDb();
  await db.query(`update briefs set client_read_at = now() where chat_token = $1`, [chatToken]);
}
