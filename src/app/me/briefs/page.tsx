import Link from "next/link";

import { PushPrompt } from "@/components/PushPrompt";
import { getDict } from "@/i18n/server";
import { vapidKeys } from "@/lib/push";
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
      <PushPrompt
        vapidKey={vapidKeys().publicKey}
        className="mb-5"
        labels={{ title: t.push.title, body: t.push.body, enable: t.push.enable, on: t.push.on, denied: t.push.denied, ios: t.push.ios }}
      />
      {briefs.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {briefs.map((brief) => (
            <li key={brief.id}>
              {/* Each request is a conversation: the row opens the chat, the request pinned on top. */}
              <Link href={`/c/${brief.chat_token}`} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 py-4">
                {brief.artist_portrait_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brief.artist_portrait_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-2">
                    <AccentDot accent={brief.artist_accent} />
                  </span>
                )}
                <span className="grid min-w-0 gap-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`truncate ${brief.unread ? "font-semibold text-bone" : "text-bone/90"}`}>{brief.artist_name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[0.78rem] text-bone-dim">
                      {brief.unread && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.68rem] font-semibold text-ink">{b.newReply}</span>}
                      {relativeTime(brief.last_at ?? brief.created_at, locale)}
                    </span>
                  </span>
                  <span className="truncate text-[0.88rem] text-bone-dim">
                    {brief.last_body ? `${brief.last_actor === "client" ? `${b.you}: ` : ""}${brief.last_body}` : `${placementLabel(brief.placement, locale)}, ${styleLabel(brief.style, locale).toLowerCase()}`}
                  </span>
                  <span className="flex items-center gap-2 text-[0.75rem] text-bone-dim">
                    <StatusPill status={brief.status} label={b.status[brief.status]} />
                    {brief.ref}
                  </span>
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
