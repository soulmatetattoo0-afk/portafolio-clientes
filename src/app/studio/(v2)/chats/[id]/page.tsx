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
import { money, sessionTime } from "@/lib/format";
import { getArtistById, getBrief, listStops } from "@/lib/queries";
import { ArtistTabs } from "@/v2/Shell";
import { demoMode, paysDirect } from "@/lib/env";
import { ProjectSheet } from "@/v2/ProjectSheet";
import { BarAction, BarSummary, type BarTone } from "@/v2/ProjectBar";
import { confirmDirectDeposit, finishTattoo, markBalancePaid } from "@/app/studio/_legacy/actions";
import { styleLabel } from "@/lib/catalog";
import { placementLabel } from "@/lib/messages";
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
  const bookedOn = chat.balance ? (() => { const s = sessionTime(new Date(chat.balance.startsAt), chat.balance.timezone, locale); return `${s.day} · ${s.time}`; })() : null;
  const ct = dict(brief.client_locale);
  // What the confirmation starts from: the artist's usual deposit and hours, the day and city the client asked for.
  const askedDate = brief.timing === "specific" ? (/\d{4}-\d{2}-\d{2}/.exec(brief.preferred_dates ?? "")?.[0] ?? null) : null;
  const defaults = { deposit: artist.default_deposit_cents != null ? artist.default_deposit_cents / 100 : null, hours: artist.default_session_hours ?? null, start: artist.default_start_time ?? null, date: askedDate, stopId: brief.tour_stop_id ?? null, client: brief.client_name.split(" ")[0] };
  // The booked date as the move form starts from it, in the artist's time zone.
  const tz = chat.balance?.timezone ?? stops[0]?.timezone ?? "America/New_York";
  const booking = chat.balance
    ? (() => {
        const start = new Date(chat.balance.startsAt);
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(start);
        const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
        const hours = Math.max(0.5, Math.round(((new Date(chat.balance.endsAt).getTime() - start.getTime()) / 3600000) * 2) / 2);
        return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, hours, deposit: money(chat.balance.depositCents, chat.balance.currency, locale) };
      })()
    : null;
  // VANTA's word on where the project stands, and the next step as one red key.
  const direct = paysDirect(artist.stripe_charges_enabled);
  const request = stage === "offered" ? [...chat.items].reverse().find((i) => i.request) : undefined;
  const owed = chat.balance?.amountCents != null ? money(chat.balance.amountCents, chat.balance.currency, locale) : "";
  const bar: { status: string; tone: BarTone; action?: React.ComponentProps<typeof BarAction> } =
    stage === "new"
      ? { status: c.barNew, tone: "new", action: { label: c.accept, event: "accept" } }
      : stage === "open"
        ? { status: c.barOpen, tone: "info", action: { label: c.evaluate, event: "confirm" } }
        : stage === "offered"
          ? request
            ? { status: fill(c.barRequested, { amount: request.amount ? money(request.amount.cents, request.amount.currency, locale) : "" }), tone: "amber", action: direct ? { label: c.barReceived, action: confirmDirectDeposit.bind(null, brief.id), confirm: c.barSure } : undefined }
            : { status: c.barOffered, tone: "info" }
          : stage === "booked"
            ? chat.balance?.requested
              ? { status: fill(c.barCharged, { amount: owed }), tone: "amber", action: direct || demoMode ? { label: direct ? c.barReceivedRest : c.cash, action: markBalancePaid.bind(null, brief.id), confirm: c.barSure } : undefined }
              : { status: fill(c.barBooked, { date: bookedOn ?? "" }), tone: "green", action: { label: fill(c.finish, { amount: owed }), action: finishTattoo.bind(null, brief.id), confirm: c.barSure } }
            : stage === "paid"
              ? { status: c.barPaid, tone: "gold" }
              : { status: t.studio.brief.events.declined, tone: "info" };
  return (
    <div className="v2-page v2-chat min-h-dvh">
      {/* The name, and under it the project pinned with VANTA's latest word and the next step. */}
      <div className="sticky top-0 z-30">
        <header className="v2-top" style={{ position: "relative" }}>
          <Link href="/studio/chats" className="grid h-11 w-9 place-items-center text-bone" aria-label={c.back}>
            <span aria-hidden className="text-[1.4rem]">←</span>
          </Link>
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent p-display text-[1.2rem] text-bone">{brief.client_name[0]}</span>
          <div className="min-w-0 flex-1">
            <p className="p-display truncate text-[1.25rem] uppercase leading-none">{brief.client_name}</p>
            <p className="mt-0.5 truncate text-[0.75rem] text-bone/55">{brief.ref}{chat.card.city ? ` · ${chat.card.city}` : ""}</p>
          </div>
        </header>
        <div className="flex items-center gap-2 border-b border-bone/[0.08] bg-[#1c1916]/95 px-3 py-2 backdrop-blur">
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
            defaults={defaults}
            t={t}
            locale={locale}
            trigger={<BarSummary title={`${styleLabel(chat.card.style, locale)} · ${placementLabel(chat.card.placement, locale)}`} status={bar.status} tone={bar.tone} placement={chat.card.placement} body={chat.card.body} />}
          />
          {bar.action && <BarAction {...bar.action} />}
        </div>
      </div>
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
          pinned={<RequestCard card={chat.card} t={t} locale={locale} artist={artist.display_name} client={brief.client_name} figure />}
          project={<RequestCard card={chat.card} t={t} locale={locale} artist={artist.display_name} client={brief.client_name} compact figure />}
          afterPinned={
            <QuoteActions
              briefId={brief.id}
              stage={stage}
              clientName={brief.client_name}
              stops={stops.map((s) => ({ id: s.id, label: s.is_home ? [s.studio_name, s.city].filter(Boolean).join(", ") : `${s.city}${s.starts_on ? ` · ${s.starts_on}` : ""}` }))}
              defaults={defaults}
              balance={chat.balance}
              bookedOn={bookedOn}
              booking={booking}
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
