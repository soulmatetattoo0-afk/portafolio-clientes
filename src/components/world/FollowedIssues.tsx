import Link from "next/link";

import { CoverSheet } from "@/components/magazine/Sheet";
import { fill, type Dict, type Locale } from "@/i18n";
import { dateRange } from "@/lib/format";
import { getDb } from "@/lib/db";
import { getMagazine, type Magazine } from "@/lib/magazine-server";

interface Shelf {
  id: string;
  slug: string;
  name: string;
  accent: string | null;
  accepting: boolean;
  magazine: Magazine;
  /** The person's open conversation with this artist, if there is one: then the button opens it. */
  chat: { token: string; unread: boolean; toPay: boolean } | null;
  /** New work in the last two weeks. */
  fresh: boolean;
  /** A guest spot coming to the person's city, with its dates. */
  visiting: { starts_on: string; ends_on: string | null } | null;
}

/** The magazines of the artists someone follows (or, with none yet, a few to start with), newest work first. */
async function shelf(userId: string | null, citySlug: string | null): Promise<{ followed: boolean; items: Shelf[] }> {
  const db = await getDb();
  const followed = userId
    ? await db.query<{ id: string; slug: string; display_name: string; accent: string | null; accepting: boolean }>(
        `select a.id, a.slug, a.display_name, a.accent, a.accepting from follows f join artists a on a.id = f.artist_id
          where f.user_id = $1 and a.listed order by (select max(published_at) from portfolio_items p where p.artist_id = a.id) desc nulls last limit 8`,
        [userId],
      )
    : [];
  const rows = followed.length
    ? followed
    : await db.query<{ id: string; slug: string; display_name: string; accent: string | null; accepting: boolean }>(
        `select a.id, a.slug, a.display_name, a.accent, a.accepting from artists a
          where a.listed and (a.magazine is not null or exists (select 1 from portfolio_items p where p.artist_id = a.id and p.image_path is not null))
          order by (a.magazine is not null) desc, a.created_at desc limit 6`,
      );
  const chats = userId
    ? await db.query<{ artist_id: string; chat_token: string; unread: boolean; to_pay: boolean }>(
        `select distinct on (b.artist_id) b.artist_id, b.chat_token,
                exists (select 1 from brief_events e where e.brief_id = b.id and e.actor = 'artist' and e.created_at > coalesce(b.client_read_at, b.created_at)) as unread,
                exists (select 1 from quotes q where q.brief_id = b.id and q.status in ('sent', 'viewed') and q.expires_at > now()) as to_pay
           from briefs b join clients c on c.id = b.client_id
          where c.user_id = $1 and b.status not in ('declined', 'archived')
          order by b.artist_id, b.created_at desc`,
        [userId],
      )
    : [];
  const chatOf = new Map(chats.map((c) => [c.artist_id, { token: c.chat_token, unread: c.unread, toPay: c.to_pay }]));
  const ids = rows.map((r) => r.id);
  const [fresh, visits] = await Promise.all([
    db.query<{ artist_id: string }>(`select distinct artist_id from portfolio_items where artist_id = any($1::uuid[]) and published and published_at > now() - interval '14 days'`, [ids]),
    citySlug
      ? db.query<{ artist_id: string; starts_on: string; ends_on: string | null }>(
          `select distinct on (artist_id) artist_id, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
             from tour_stops where artist_id = any($1::uuid[]) and city_slug = $2 and not is_home and status in ('announced', 'booking')
              and starts_on <= current_date + 60 and (ends_on is null or ends_on >= current_date)
            order by artist_id, starts_on`,
          [ids, citySlug],
        )
      : [],
  ]);
  const freshSet = new Set(fresh.map((f) => f.artist_id));
  const visitOf = new Map(visits.map((v) => [v.artist_id, { starts_on: v.starts_on, ends_on: v.ends_on }]));
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id, slug: r.slug, name: r.display_name, accent: r.accent, accepting: r.accepting,
      magazine: await getMagazine(r.id), chat: chatOf.get(r.id) ?? null, fresh: freshSet.has(r.id), visiting: visitOf.get(r.id) ?? null,
    })),
  );
  return { followed: followed.length > 0, items };
}

/**
 * "Your saved artists": the covers of the magazines a person follows, like a
 * shelf. Under each, one neutral button: ask for a quote, or open the
 * conversation already running with that artist. The colour belongs to the
 * covers; the shelf stays quiet.
 */
export async function FollowedIssues({ userId, citySlug, t, locale, folio }: { userId: string | null; citySlug: string | null; t: Dict; locale: Locale; folio: React.ReactNode }) {
  const { followed, items } = await shelf(userId, citySlug);
  if (!items.length) return null;
  const f = t.world.followed;
  return (
    <section className="mt-16 md:mt-24" aria-labelledby="home-followed">
      {folio}
      <h2 id="home-followed" className="p-display mt-3 text-[clamp(2.3rem,11vw,3.6rem)] leading-[0.88] text-bone">
        {f.title}
      </h2>
      {!followed && <p className="mt-2 max-w-[40ch] text-[0.95rem] text-bone-dim">{f.startWith}</p>}
      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-5 md:px-0">
        {items.map((a) => (
          <li key={a.id} className="w-[58vw] max-w-[16rem] shrink-0 snap-start md:w-auto md:max-w-none" style={{ ["--accent" as string]: a.accent ?? "#d8552f" }}>
            <Link href={`/${a.slug}#bio`} className="relative block overflow-hidden rounded-[2px] shadow-[0_24px_40px_-20px_rgb(0_0_0/0.9)] transition hover:-translate-y-1" aria-label={a.name}>
              <CoverSheet cover={a.magazine.doc.cover} name={a.name} urls={a.magazine.urls} ph={t.magazine.ph} />
              {/* What's new with this artist, stamped on the cover like a sticker. */}
              {(() => {
                const note = a.chat?.unread ? f.badgeMessage : a.chat?.toPay ? f.badgePay : a.visiting ? fill(f.badgeVisiting, { dates: dateRange(a.visiting.starts_on, a.visiting.ends_on, locale) }) : a.fresh ? f.badgeNew : null;
                return note ? (
                  <span className="p-stamp absolute bottom-2 left-2 z-30 flex items-center gap-1.5 rounded-full bg-bone px-2.5 py-1 text-[0.55rem] text-ink shadow">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {note}
                  </span>
                ) : null;
              })()}
            </Link>
            <p className="p-stamp mt-2.5 text-[0.58rem] text-bone-dim">{a.accepting ? f.open : f.closed}</p>
            {a.chat ? (
              <Link href={`/c/${a.chat.token}`} className="btn btn-secondary mt-2 w-full gap-2">
                {a.chat.unread && <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />}
                {a.chat.toPay ? f.payDeposit : f.openChat}
              </Link>
            ) : a.accepting ? (
              <Link href={`/${a.slug}/request`} className="btn btn-primary mt-2 w-full">
                {f.quote}
              </Link>
            ) : (
              <Link href={`/${a.slug}#spots`} className="btn btn-secondary mt-2 w-full">
                {f.notify}
              </Link>
            )}
          </li>
        ))}
        {/* The shelf ends on the way to more. */}
        <li className="w-[58vw] max-w-[16rem] shrink-0 snap-start md:w-auto md:max-w-none">
          <Link href="/explore" className="grid aspect-[2/3] place-items-center rounded-[2px] border border-dashed border-line-strong p-6 text-center text-bone-dim transition hover:border-bone hover:text-bone">
            <span>
              <span aria-hidden className="block text-[2.4rem] leading-none">+</span>
              <span className="mt-2 block text-[0.95rem]">{followed ? f.more : f.empty}</span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
