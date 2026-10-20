import Link from "next/link";

import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import { getArtistById } from "@/lib/queries";
import { ArtistTabs } from "@/v2/Shell";

export const metadata = { robots: { index: false } };

type Row = { id: string; ref: string; status: string; client: string; style: string; placement: string; city: string | null; created_at: Date; last_body: string | null; last_actor: string | null; last_at: Date | null; answered: boolean; unread: boolean; booked: boolean };
type Tab = "all" | "pending" | "accepted";

/** Chats: every conversation, the pending quotes, the accepted ones. Each row opens the room. */
export default async function ChatsPage({ searchParams }: PageProps<"/studio/chats">) {
  const member = await requireMember();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "pending" || sp.tab === "accepted" ? sp.tab : "all";
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  const c = t.v2.chats;
  const db = await getDb();
  const rows = await db.query<Row>(
    `select b.id, b.ref, b.status, c.name as client, b.style, b.placement, ts.city, b.created_at,
            m.body as last_body, m.actor as last_actor, m.created_at as last_at,
            exists (select 1 from brief_events e where e.brief_id = b.id and e.actor = 'artist') as answered,
            exists (select 1 from brief_events e where e.brief_id = b.id and e.actor = 'client' and e.kind <> 'created' and e.created_at > coalesce(b.artist_read_at, b.created_at)) as unread,
            exists (select 1 from appointments ap where ap.brief_id = b.id and ap.status in ('confirmed', 'completed')) as booked
       from briefs b join clients c on c.id = b.client_id left join tour_stops ts on ts.id = b.tour_stop_id
       left join lateral (select body, actor, created_at from brief_events where brief_id = b.id and kind in ('message', 'offer') order by created_at desc limit 1) m on true
      where b.studio_id = $1 and b.status not in ('archived', 'declined')
      order by coalesce(m.created_at, b.created_at) desc limit 200`,
    [member.studioId],
  );
  const list = rows.filter((r) => (tab === "pending" ? !r.answered : tab === "accepted" ? r.answered : true));
  const counts = { all: rows.length, pending: rows.filter((r) => !r.answered).length, accepted: rows.filter((r) => r.answered).length };
  return (
    <div className="v2-page min-h-dvh">
      <header className="v2-top">
        <h1 className="p-display flex-1 text-[1.8rem] uppercase leading-none">{c.title}</h1>
      </header>
      <div className="v2-seg px-4 pt-2 pb-3" role="tablist">
        {(["all", "pending", "accepted"] as Tab[]).map((k) => (
          <Link key={k} href={k === "all" ? "/studio/chats" : `/studio/chats?tab=${k}`} role="tab" aria-selected={tab === k}>
            {k === "all" ? c.all : k === "pending" ? c.pending : c.accepted}
            {counts[k] ? <span className="ml-1.5 opacity-60">{counts[k]}</span> : null}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-5 pt-6 text-bone-dim">{rows.length === 0 ? c.empty : c.emptyTab}</p>
      ) : (
        <ul className="divide-y divide-bone/10 border-y border-bone/10">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/studio/chats/${r.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full p-display text-[1.3rem] ${r.unread || !r.answered ? "bg-accent text-bone" : "bg-ink-2 text-bone/70"}`}>{r.client[0]}</span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate ${r.unread || !r.answered ? "font-semibold text-bone" : "text-bone/90"}`}>{r.client}</span>
                    <span className="shrink-0 text-[0.72rem] text-bone-dim">{relativeTime(r.last_at ?? r.created_at, locale)}</span>
                  </span>
                  <span className="truncate text-[0.85rem] text-bone-dim">
                    {r.last_body ? `${r.last_actor === "artist" ? `${t.me.briefs.you}: ` : ""}${r.last_body}` : `${placementLabel(r.placement, locale)} · ${styleLabel(r.style, locale)}`}
                  </span>
                  <span className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em]">
                    <span className={r.booked ? "text-[var(--color-olive)]" : !r.answered ? "text-accent" : "text-bone-dim"}>{r.booked ? c.booked : !r.answered ? c.waiting : c.open}</span>
                    {r.city && <span className="text-bone-dim normal-case tracking-normal">· {r.city}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {artist && <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} badge={counts.pending} />}
    </div>
  );
}
