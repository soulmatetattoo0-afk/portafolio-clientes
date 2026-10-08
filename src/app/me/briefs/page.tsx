import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { styleLabel } from "@/lib/catalog";
import { listMyBriefs, requireClient } from "@/lib/client";
import { relativeTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";

import { AccentDot, Empty, PageHead, StatusPill } from "../ui";

export const metadata = { robots: { index: false } };

export default async function MyBriefsPage() {
  const me = await requireClient("/me/briefs");
  const [{ t, locale }, briefs] = await Promise.all([getDict(), listMyBriefs(me.userId)]);
  const b = t.me.briefs;
  return (
    <>
      <PageHead title={b.title} lead={b.lead} />
      {briefs.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {briefs.map((brief) => (
            <li key={brief.id}>
              <Link href={`/me/briefs/${brief.id}`} className="grid gap-2 py-4">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[0.92rem] text-bone-dim">
                    <AccentDot accent={brief.artist_accent} />
                    <span className="truncate">{brief.artist_name}</span>
                  </span>
                  <StatusPill status={brief.status} label={b.status[brief.status]} />
                </span>
                <span className="p-quote text-[1.4rem] leading-tight text-bone">
                  {placementLabel(brief.placement, locale)}, {styleLabel(brief.style, locale).toLowerCase()}
                </span>
                <span className="text-[0.85rem] text-bone-dim">
                  {brief.ref}. {fill(b.sentAt, { time: relativeTime(brief.created_at, locale) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={b.empty} cta={{ href: "/explore", label: b.emptyCta }} />
      )}
    </>
  );
}
