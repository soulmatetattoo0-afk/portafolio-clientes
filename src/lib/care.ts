import { dict } from "@/i18n";

import type { Db } from "./db";
import { notify } from "./push";

/**
 * The artist's care sheets: before the tattoo (sent when the deposit is paid)
 * and after it (sent when the balance is paid). Each lands in the chat as a
 * message from the artist, so it stays there for the client to come back to.
 */
export async function sendCareSheet(db: Db, briefId: string, stage: "pre" | "post") {
  const r = await db.one<{ studio_id: string; artist: string; text: string | null; client_user: string | null; client_locale: "en" | "es"; chat_token: string }>(
    `select b.studio_id, a.display_name as artist, ${stage === "pre" ? "a.precare" : "a.postcare"} as text, c.user_id as client_user, c.locale as client_locale, b.chat_token
       from briefs b join artists a on a.id = b.artist_id join clients c on c.id = b.client_id where b.id = $1`,
    [briefId],
  );
  if (!r) return;
  const t = dict(r.client_locale).care;
  const body = `${stage === "pre" ? t.preTitle : t.postTitle}\n\n${r.text?.trim() || (stage === "pre" ? t.preDefault : t.postDefault)}`;
  const dup = await db.one(`select 1 from brief_events where brief_id = $1 and kind = 'message' and data->>'care' = $2`, [briefId, stage]);
  if (dup) return;
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'message', 'artist', $3, $4)`, [r.studio_id, briefId, body, JSON.stringify({ care: stage })]);
  await notify([r.client_user], { title: stage === "pre" ? t.preTitle : t.postTitle, body: r.artist, url: `/c/${r.chat_token}`, tag: `care:${briefId}` });
}
