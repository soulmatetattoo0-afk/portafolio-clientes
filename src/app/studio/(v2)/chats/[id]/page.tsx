import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtistRoom } from "@/v2/ArtistRoom";
import { RequestCard } from "@/components/chat/RequestCard";
import { fill } from "@/i18n";
import { dict } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getChat } from "@/lib/chat";
import { getDb } from "@/lib/db";
import { demoAutoBook } from "@/lib/demo";
import { sessionTime } from "@/lib/format";
import { getArtistById, getBrief, listStops } from "@/lib/queries";
import { ArtistTabs } from "@/v2/Shell";
import { demoMode, paysDirect } from "@/lib/env";
import { ProjectSheet } from "@/v2/ProjectSheet";
import { QuoteActions, type QuoteStage } from "@/v2/QuoteActions";

export const metadata = { robots: { index: false } };

/** One conversation: the client's letter on top with what the artist does next under it, then the messages. */
export default async function ChatPage({ params }: PageProps<"/studio/chats/[id]">) {
  const { id } = await params;
  const member = await requireMember();
  // The demo's client books on their own once the quote has sat for half a minute.
  await demoAutoBook(await getDb(), member.studioId, id).catch(() => false);
  const [{ t, locale }, brief, chat, artist, stops] = await Promise.all([getDict(), getBrief(member.studioId, id), getChat(member.studioId, id), getArtistById(member.artistId), listStops(member.artistId)]);
  if (!brief || !chat || !artist) notFound();
  const c = t.v2.chats;
  const answered = chat.items.some((i) => i.actor === "artist");
  const offered = chat.items.some((i) => i.kind === "offer" && i.offer && (i.offer.status === "sent" || i.offer.status === "viewed") && !i.offer.expired);
  const stage: QuoteStage =
    brief.status === "declined" || brief.status === "archived" ? "closed" : chat.balance?.paid ? "paid" : chat.balance ? "booked" : !answered ? "new" : offered ? "offered" : "open";
  const bookedOn = chat.balance ? (() => { const s = sessionTime(new Date(chat.balance.startsAt), stops[0]?.timezone ?? "America/New_York", locale); return `${s.day} · ${s.time}`; })() : null;
  const ct = dict(brief.client_locale);
  return (
    <div className="v2-page min-h-dvh">
      <header className="v2-top">
        <Link href="/studio/chats" className="grid h-11 w-11 place-items-center text-bone" aria-label={c.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="p-display truncate text-[1.35rem] uppercase leading-none">{brief.client_name}</p>
          <p className="truncate text-[0.75rem] text-bone-dim">
            {brief.ref} · {stage === "new" ? c.waiting : stage === "offered" ? c.sent : stage === "booked" ? c.booked : stage === "paid" ? c.paid : stage === "closed" ? t.studio.brief.events.declined : c.open}
          </p>
        </div>
        <ProjectSheet
          briefId={brief.id}
          card={chat.card}
          balance={chat.balance}
          stage={stage}
          bookedOn={bookedOn}
          chatToken={chat.chat_token}
          demo={demoMode}
          direct={paysDirect(artist.stripe_charges_enabled)}
          stops={stops.map((s) => ({ id: s.id, label: s.is_home ? [s.studio_name, s.city].filter(Boolean).join(", ") : `${s.city}${s.starts_on ? ` · ${s.starts_on}` : ""}` }))}
          defaults={{ deposit: artist.default_deposit_cents != null ? artist.default_deposit_cents / 100 : null, hours: artist.default_session_hours ?? null, start: artist.default_start_time ?? null }}
          t={t}
          locale={locale}
        />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        <ArtistRoom
          briefId={brief.id}
          items={chat.items}
          names={{ client: brief.client_name, artist: artist.display_name }}
          t={t.chat}
          careLabels={{ download: t.care.download, from: t.care.from }}
          toast={c.bookedToast}
          waitingForClient={stage === "offered"}
          locale={locale}
          pinned={<RequestCard card={chat.card} t={t} locale={locale} artist={artist.display_name} figure />}
          project={<RequestCard card={chat.card} t={t} locale={locale} artist={artist.display_name} compact figure />}
          afterPinned={
            <QuoteActions
              briefId={brief.id}
              stage={stage}
              clientName={brief.client_name}
              stops={stops.map((s) => ({ id: s.id, label: s.is_home ? [s.studio_name, s.city].filter(Boolean).join(", ") : `${s.city}${s.starts_on ? ` · ${s.starts_on}` : ""}` }))}
              defaults={{ deposit: artist.default_deposit_cents != null ? artist.default_deposit_cents / 100 : null, hours: artist.default_session_hours ?? null, start: artist.default_start_time ?? null }}
              balance={chat.balance}
              bookedOn={bookedOn}
              currency={brief.currency}
              template={fill(ct.templates.accept, { name: brief.client_name.split(" ")[0] })}
              direct={paysDirect(artist.stripe_charges_enabled)}
              t={t}
              locale={locale}
            />
          }
        />
      </main>
      <ArtistTabs slug={artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} />
    </div>
  );
}
