import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { cmLabel, moneyRange, relativeTime } from "@/lib/format";
import { getArtistById, getBrief, inboxCounts, listBriefs, type InboxTab } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { BriefView, STATUS_TONE, statusLabel } from "./BriefView";
import { CopyButton } from "./CopyButton";

const TABS: InboxTab[] = ["new", "needs_info", "quoted", "booked", "closed"];

export default async function RequestsPage({ searchParams }: PageProps<"/studio">) {
  const member = await requireMember();
  const sp = await searchParams;
  const tab: InboxTab = TABS.includes(sp.tab as InboxTab) ? (sp.tab as InboxTab) : "new";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const selectedId = typeof sp.brief === "string" && /^[0-9a-f-]{36}$/.test(sp.brief) ? sp.brief : null;

  const [{ t, locale }, counts, items, artist] = await Promise.all([getDict(), inboxCounts(member.studioId), listBriefs(member.studioId, tab, q), getArtistById(member.artistId)]);
  const selected = selectedId ? await getBrief(member.studioId, selectedId) : null;
  if (selected && !selected.seen_at) {
    const db = await getDb();
    await db.query(`update briefs set seen_at = now() where id = $1 and studio_id = $2`, [selected.id, member.studioId]);
  }
  const r = t.studio.requests;
  const href = (params: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const merged = { tab, q: q || null, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/studio?${u.toString()}`;
  };
  const pageUrl = artist ? `${env.appUrl}/${artist.slug}` : env.appUrl;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className={selected ? "hidden lg:block" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-title">{r.title}</h1>
            <p className="mt-1 text-ash">{r.lead}</p>
          </div>
          <CopyButton text={pageUrl} label={r.copyLink} done={t.common.copied} />
        </div>
        {sp.sent === "quote" && selected && (
          <p role="status" className="mt-5 rounded-[var(--radius-md)] border border-verdigris/40 px-4 py-3 text-verdigris">
            {fill(t.studio.quoteForm.sent, { email: selected.client_email })}
          </p>
        )}
        <nav aria-label={r.title} className="-mx-4 mt-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-6">
            {TABS.map((key) => (
              <li key={key}>
                <Link
                  href={href({ tab: key, brief: null })}
                  aria-current={tab === key ? "page" : undefined}
                  className="-mb-px flex items-center gap-2 border-b-2 border-transparent pb-3 whitespace-nowrap text-ash hover:text-vellum aria-[current=page]:border-gilt aria-[current=page]:text-vellum"
                >
                  {r.tabs[key]}
                  <span className="t-num text-[0.8rem] text-ash-dim">{counts[key]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
        <div className={selected ? "hidden lg:block" : ""}>
          <form action="/studio" className="mb-3">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="req-search" className="sr-only">
              {r.search}
            </label>
            <input id="req-search" name="q" type="search" defaultValue={q} placeholder={r.search} className="input" />
          </form>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-niche">
            {items.length === 0 ? (
              <p className="p-5 text-[0.95rem] text-ash">{r.empty[tab]}</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((b) => {
                  const active = b.id === selected?.id;
                  const placement = PLACEMENT_BY_SLUG.get(b.placement)?.label[locale] ?? b.placement;
                  return (
                    <li key={b.id}>
                      <Link
                        href={href({ brief: b.id })}
                        aria-current={active ? "true" : undefined}
                        className="relative grid gap-1 px-4 py-3.5 transition-colors hover:bg-niche-2 aria-[current=true]:bg-niche-2"
                      >
                        {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-gilt" />}
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            {!b.seen_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gilt" aria-label={r.unseen} />}
                            <span className="truncate">{b.client_name}</span>
                          </span>
                          <span className="t-meta shrink-0">{relativeTime(b.created_at, locale)}</span>
                        </span>
                        <span className="truncate text-[0.9rem] text-vellum/85">
                          {placement}
                          {b.full_coverage ? "" : b.size_w_cm ? `, ${cmLabel(b.size_w_cm, b.size_h_cm)}` : ""}
                        </span>
                        <span className="flex items-center justify-between gap-3 text-[0.82rem] text-ash">
                          <span className="t-num truncate">{moneyRange(b.budget_min_cents, b.budget_max_cents, b.currency, locale)}</span>
                          {b.city && <span className="truncate">{b.city}</span>}
                        </span>
                        {tab === "closed" && <span className={`text-[0.78rem] ${STATUS_TONE[b.status]}`}>{statusLabel(b.status, t)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
          {selected ? (
            <>
              <Link href={href({ brief: null })} className="btn btn-ghost btn-sm mb-4 -ml-2 lg:hidden">
                {t.common.back}
              </Link>
              <BriefView brief={selected} t={t} locale={locale} />
            </>
          ) : (
            <div className="grid h-full min-h-64 place-items-center rounded-[var(--radius-lg)] border border-dashed border-line p-8 text-center text-ash">{r.selectOne}</div>
          )}
        </div>
      </div>
    </main>
  );
}
