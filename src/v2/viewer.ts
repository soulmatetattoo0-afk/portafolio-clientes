import { getDict } from "@/i18n/server";
import { getSession, requireMember, type Member } from "@/lib/auth";
import { getClientUser, isFollowing, listMyChatsWith, unreadChats, type ClientUser, type MyChat } from "@/lib/client";
import { getDb } from "@/lib/db";
import { inboxCounts, type Artist } from "@/lib/queries";

/**
 * Who is looking at an artist's page: the artist themself (their studio's
 * copy of the page carries the edit buttons and the artist's bar), or a
 * client (their chats with this artist, whether they follow them, and the
 * client's bar).
 */
export async function getViewer(artist: Artist | null, opts: { owner?: boolean } = {}) {
  const [{ t, locale }, session] = await Promise.all([getDict(), getSession()]);
  // The studio's copy: the signed-in artist (in local mode and previews, the demo artist).
  const member: Member | null = opts.owner ? await requireMember() : null;
  const owner = Boolean(opts.owner && member && artist && member.artistId === artist.id);
  const client: ClientUser | null = owner ? null : await getClientUser(session);
  const [chats, following, unread, pending] = await Promise.all([
    client && artist ? listMyChatsWith(client.userId, [artist.id]) : Promise.resolve<MyChat[] | null>(null),
    client && artist ? isFollowing(client.userId, artist.id) : Promise.resolve<boolean | null>(null),
    client ? unreadChats(client.userId) : Promise.resolve(0),
    owner && member ? inboxCounts(member.studioId).then((c) => c.new) : Promise.resolve(0),
  ]);
  return { t, locale, member, owner, client, chats, following, unread, pending };
}

/** One more visit to the artist's page today (never the artist's own). */
export async function countVisit(artistId: string) {
  const db = await getDb();
  await db.query(
    `insert into page_views (artist_id, day, n) values ($1, current_date, 1) on conflict (artist_id, day) do update set n = page_views.n + 1`,
    [artistId],
  );
}
