import Link from "next/link";

import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import { getArtistById } from "@/lib/queries";
import { BodyChart, chartViews } from "@/components/chat/BodyChart";
import { ArtistTabs } from "@/v2/Shell";

export const metadata = { robots: { index: false } };

type Row = { id: string; ref: string; status: string; client: string; style: string; placement: string; body: "f" | "m"; city: string | null; created_at: Date; last_body: string | null; last_actor: string | null; last_at: Date | null; answered: boolean; unread: boolean; booked: boolean };
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
    `select b.id, b.ref, b.status, c.name as client, b.style, b.placement, b.body, ts.city, b.created_at,
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
    <div className="v2-page v2-chat min-h-dvh">
      <header className="px-4 pt-[max(env(safe-area-inset-top),0.9rem)] pb-1">
        <h1 className="p-display text-[2.4rem] uppercase leading-none">{c.title}</h1>
      </header>
      <div className="grid grid-cols-3 gap-1 px-4 pt-3 pb-4" role="tablist">
        {(["all", "pending", "accepted"] as Tab[]).map((k) => (
          <Link
            key={k}
            href={k === "all" ? "/studio/chats" : `/studio/chats?tab=${k}`}
            role="tab"
            aria-selected={tab === k}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[0.84rem] font-semibold ${tab === k ? "bg-bone text-ink" : "bg-bone/[0.06] text-bone/80"}`}
          >
            {k === "all" ? c.all : k === "pending" ? c.pending : c.accepted}
            {counts[k] ? <span className={`rounded-full px-1.5 text-[0.7rem] leading-[1.15rem] ${k === "pending" && tab !== k ? "bg-accent text-bone" : "opacity-60"}`}>{counts[k]}</span> : null}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-5 pt-6 text-bone/60">{rows.length === 0 ? c.empty : c.emptyTab}</p>
      ) : (
        <ul className="grid gap-2 px-3 pb-4">
          {list.map((r) => {
            const hot = r.unread || !r.answered;
            return (
              <li key={r.id}>
                <Link href={`/studio/chats/${r.id}`} className={`flex items-center gap-3 rounded-[22px] border p-3 transition-colors active:bg-bone/[0.08] ${hot ? "border-accent/35 bg-[#2a2421]" : "border-bone/[0.07] bg-[#221e1b]"}`}>
                  <span className="relative shrink-0">
                    <span className={`grid h-12 w-12 place-items-center rounded-full p-display text-[1.3rem] ${!r.answered ? "bg-accent text-bone" : "bg-[#3a332e] text-bone"}`}>{r.client[0]}</span>
                    {r.unread && <span aria-hidden className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#2a2421] bg-accent" />}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-[1rem] ${hot ? "font-semibold text-bone" : "text-bone/90"}`}>{r.client}</span>
                      <span className="shrink-0 text-[0.7rem] text-bone/45">{relativeTime(r.last_at ?? r.created_at, locale)}</span>
                    </span>
                    <span className={`truncate text-[0.85rem] ${hot ? "text-bone/80" : "text-bone/55"}`}>
                      {r.last_body ? `${r.last_actor === "artist" ? `${t.me.briefs.you}: ` : ""}${r.last_body}` : `${placementLabel(r.placement, locale)} · ${styleLabel(r.style, locale)}`}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-[0.62rem]">
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.1em] ${r.booked ? "bg-[#8fb07a]/15 text-[#b5d1a2]" : !r.answered ? "bg-accent text-bone" : "bg-bone/10 text-bone/70"}`}>{r.booked ? c.booked : !r.answered ? c.waiting : c.open}</span>
                      {r.city && <span className="truncate text-[0.72rem] text-bone/45">{r.city}</span>}
                    </span>
                  </span>
                  {/* The request in miniature: a scrap of the letter with the area drawn. */}
                  <span aria-hidden className="grid h-[4.2rem] w-11 shrink-0 place-items-center rounded-[4px] bg-[#f3ecdf] shadow-[0_8px_16px_-10px_rgb(0_0_0/0.9)]" style={{ transform: `rotate(${r.id.charCodeAt(0) % 2 ? 2 : -2}deg)` }}>
                    <BodyChart placement={r.placement} body={r.body} views={[chartViews(r.placement)[0] ?? "front"]} className="w-6" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {artist && <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} badge={counts.pending} />}
    </div>
  );
}
