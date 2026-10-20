import Link from "next/link";

import { PushPrompt } from "@/components/PushPrompt";
import { getDict } from "@/i18n/server";
import { styleLabel } from "@/lib/catalog";
import { listMyAppointments, listMyBriefs, requireClient } from "@/lib/client";
import { relativeTime, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import { vapidKeys } from "@/lib/push";

export const metadata = { robots: { index: false } };

type Tab = "all" | "pending" | "answered";

/** Mensajes: every artist the client wrote to; the open chats first, the pending quotes after. */
export default async function MessagesPage({ searchParams }: PageProps<"/me">) {
  const me = await requireClient("/me");
  const sp = await searchParams;
  const tab: Tab = sp.tab === "pending" || sp.tab === "answered" ? sp.tab : "all";
  const [{ t, locale }, briefs, appointments] = await Promise.all([getDict(), listMyBriefs(me.userId), listMyAppointments(me.userId)]);
  const m = t.v2.me;
  const answered = (b: (typeof briefs)[number]) => b.status !== "new" || b.last_actor === "artist";
  const sorted = [...briefs].sort((a, b) => Number(answered(b)) - Number(answered(a)));
  const list = sorted.filter((b) => (tab === "pending" ? !answered(b) : tab === "answered" ? answered(b) : true));
  const next = appointments.upcoming[0];
  return (
    <div className="min-h-dvh">
      <header className="v2-top">
        <h1 className="p-display flex-1 text-[1.8rem] uppercase leading-none">{m.messages}</h1>
      </header>
      <main className="mx-auto w-full max-w-2xl">
        <div className="v2-seg px-4 pt-2 pb-3" role="tablist">
          {(["all", "pending", "answered"] as Tab[]).map((k) => (
            <Link key={k} href={k === "all" ? "/me" : `/me?tab=${k}`} role="tab" aria-selected={tab === k}>
              {k === "all" ? m.all : k === "pending" ? m.pending : m.answered}
            </Link>
          ))}
        </div>
        <div className="px-4">
          <PushPrompt vapidKey={vapidKeys().publicKey} className="mb-3" labels={{ title: t.push.title, body: t.push.body, enable: t.push.enable, on: t.push.on, denied: t.push.denied, ios: t.push.ios }} />
          {next && next.brief_id && (
            <Link href={`/c/${briefs.find((b) => b.id === next.brief_id)?.chat_token ?? ""}`} className="v2-sheet mb-3 flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: next.artist_accent ?? "var(--accent)" }}>
              <span>
                <span className="p-stamp block text-bone/60">{m.next}</span>
                <span className="block text-[1.05rem] font-semibold">{next.artist_name}</span>
                <span className="text-[0.85rem] text-bone-dim">
                  {sessionTime(next.starts_at, next.timezone, locale).day} · {sessionTime(next.starts_at, next.timezone, locale).time}
                  {next.city ? ` · ${next.city}` : ""}
                </span>
              </span>
              <span aria-hidden>›</span>
            </Link>
          )}
        </div>
        {list.length === 0 ? (
          <p className="px-5 pt-4 text-bone-dim">{briefs.length === 0 ? m.empty : m.emptyTab}</p>
        ) : (
          <ul className="divide-y divide-bone/10 border-y border-bone/10">
            {list.map((b) => (
              <li key={b.id}>
                <Link href={`/c/${b.chat_token}`} className="flex items-center gap-3 px-4 py-3.5">
                  {b.artist_portrait_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.artist_portrait_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full p-display text-[1.3rem]" style={{ background: b.artist_accent ?? "var(--accent)" }}>{b.artist_name[0]}</span>
                  )}
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate ${b.unread ? "font-semibold text-bone" : "text-bone/90"}`}>{b.artist_name}</span>
                      <span className="shrink-0 text-[0.72rem] text-bone-dim">{relativeTime(b.last_at ?? b.created_at, locale)}</span>
                    </span>
                    <span className="truncate text-[0.85rem] text-bone-dim">{b.last_body ? `${b.last_actor === "client" ? `${t.me.briefs.you}: ` : ""}${b.last_body}` : `${placementLabel(b.placement, locale)} · ${styleLabel(b.style, locale)}`}</span>
                    <span className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em]">
                      <span className={b.status === "booked" ? "text-[var(--color-olive,#6f8f5c)]" : answered(b) ? "text-bone-dim" : "text-accent"}>{b.status === "booked" ? m.reserved : answered(b) ? m.answered1 : m.waiting}</span>
                      {b.unread && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.62rem] font-bold normal-case tracking-normal text-bone">{t.me.briefs.newReply}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
