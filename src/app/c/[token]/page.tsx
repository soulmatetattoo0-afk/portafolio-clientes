import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LangToggle } from "@/components/LangToggle";
import { RequestCard } from "@/components/chat/RequestCard";
import { getDict } from "@/i18n/server";
import { PushPrompt } from "@/components/PushPrompt";
import { getChatByToken } from "@/lib/chat";
import { getDb } from "@/lib/db";
import { serviceFee } from "@/lib/mercadopago";
import { advanceShowcase } from "@/lib/showcase";
import { ClientProject } from "@/v2/ClientProject";
import { getClientUser, unreadChats } from "@/lib/client";
import { paysDirect } from "@/lib/env";
import { vapidKeys } from "@/lib/push";
import { ArtistTabs, ClientTabs } from "@/v2/Shell";

import { BarAction, BarSummary, type BarTone } from "@/v2/ProjectBar";
import { fill } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import { money, requestTime, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";

import { cancelMyBooking, payBalance, skipDemoSession } from "./actions";
import { ClientChat } from "./ClientChat";

export async function generateMetadata({ params }: PageProps<"/c/[token]">): Promise<Metadata> {
  const { token } = await params;
  const thread = await getChatByToken(token);
  return { title: thread ? `${thread.artist.name} · ${thread.card.ref}` : undefined, robots: { index: false, follow: false } };
}

/**
 * The client's conversation with the artist, behind the request's private
 * link. The request is pinned above; the house note under it explains that
 * the artist answers first, and then the client can write.
 */
export default async function ChatPage({ params, searchParams }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const justSent = sp.sent === "1";
  // Opened from the studio (the artist walking the client's side in the demo): the artist's bar, never the client's profile.
  const fromStudio = sp.from === "studio";
  // A demo conversation first catches up: the artist's stand-in writes whatever has come due.
  const demo = await advanceShowcase(await getDb(), token).catch(() => null);
  const thread = await getChatByToken(token);
  if (!thread) notFound();
  const [{ t, locale }, me] = await Promise.all([getDict(), getClientUser()]);
  const unread = me ? await unreadChats(me.userId) : 0;
  const c = t.chat;
  const accent = thread.artist.accent ?? "#d8552f";
  // Where the project stands, seen from the client's side, and their next step.
  const direct = !thread.demo && paysDirect(thread.artist.charges, thread.artist.mp);
  const suffix = fromStudio ? "?from=studio" : "";
  const answered = thread.items.some((i) => i.actor === "artist");
  const offers = thread.items.filter((i) => i.kind === "offer" && i.offer).map((i) => i.offer!);
  const open = [...offers].reverse().find((o) => (o.status === "sent" || o.status === "viewed") && !o.expired);
  const bookedOffer = [...offers].reverse().find((o) => o.status === "paid");
  const requested = open && thread.items.some((i) => i.request);
  const when = bookedOffer?.starts_at && bookedOffer.timezone ? sessionTime(new Date(bookedOffer.starts_at), bookedOffer.timezone, locale) : null;
  const b = thread.balance;
  const nowMs = requestTime();
  const rest = b?.amountCents != null ? money(b.amountCents, b.currency, locale) : "";
  const bar: { status: string; tone: BarTone; action?: React.ComponentProps<typeof BarAction> } =
    b?.paid
      ? { status: c.bar.paid, tone: "gold" }
      : b
        ? b.open && b.amountCents != null && !direct
          ? { status: fill(c.bar.booked, { date: when ? `${when.day} · ${when.time}` : "" }), tone: "green", action: { label: fill(c.bar.payRest, { amount: rest }), action: payBalance.bind(null, token) } }
          : {
              status: b.requested && direct ? fill(c.bar.payDirect, { amount: rest, artist: thread.artist.name }) : fill(c.bar.booked, { date: when ? `${when.day} · ${when.time}` : "" }),
              tone: b.requested ? "amber" : "green",
              // Before the session, the client can cancel: seven days ahead the deposit comes back, later it stays with the artist.
              action:
                me && !fromStudio && !b.open && bookedOffer?.starts_at && new Date(bookedOffer.starts_at).getTime() > nowMs
                  ? {
                      label: c.cancel.button,
                      tone: "ghost",
                      action: cancelMyBooking.bind(null, token),
                      confirm: new Date(bookedOffer.starts_at).getTime() - nowMs >= 7 * 86_400_000 ? c.cancel.confirmRefund : c.cancel.confirmLate,
                    }
                  : undefined,
            }
        : requested
          ? { status: fill(c.bar.requested, { artist: thread.artist.name, amount: open ? money(open.deposit_cents, open.currency, locale) : "" }), tone: "amber" }
          : open
            ? { status: fill(c.bar.saved, { total: money(open.price_min_cents, open.currency, locale) }), tone: "new", action: { label: c.bar.reserve, href: `/q/${open.token}${suffix}` } }
            : answered
              ? { status: c.bar.open, tone: "info" }
              : { status: fill(c.bar.waiting, { artist: thread.artist.name }), tone: "info" };

  const shown = bookedOffer ?? open;
  // The deposit is paid in the app (Mercado Pago, or simulated in the demo): VANTA's service shows beside it.
  const feeCents = shown && (thread.demo || (thread.artist.mp && !direct)) ? serviceFee(shown.deposit_cents) : null;
  const edited = Boolean(open) && offers.some((o) => o.status === "withdrawn");
  const sc = t.showcase;
  return (
    <div className={`poster v2-chat min-h-dvh ${me || fromStudio ? "v2-page" : ""}`} style={{ ["--accent" as string]: accent }}>
      <header className="sticky top-0 z-20 border-b border-bone/[0.07] bg-[#1f1b18]/94 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2.5">
          <Link href={`/${thread.artist.slug}`} className="text-[1.3rem] leading-none text-bone" aria-label={thread.artist.name}>
            ←
          </Link>
          {thread.artist.portrait_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thread.artist.portrait_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="p-display truncate text-[1.35rem] leading-none">{thread.artist.name}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[0.78rem] text-bone/55">
              {thread.demo && <span className="shrink-0 rounded-full bg-[#e8c46b] px-1.5 py-px text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#1d1a17]">{sc.badge}</span>}
              <span className="truncate">{thread.demo ? fill(sc.subtitle, { artist: thread.artist.name }) : c.subtitle}</span>
            </p>
          </div>
          <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
        </div>
        {/* The project pinned under the artist's name, VANTA's word on it, and the client's next step. */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-bone/[0.07] px-3 py-2">
          <ClientProject
            card={thread.card}
            items={thread.items}
            balance={thread.balance}
            artist={thread.artist.name}
            feeCents={feeCents}
            reserveHref={open ? `/q/${open.token}${suffix}` : undefined}
            letter={<RequestCard card={thread.card} t={t} locale={locale} artist={thread.artist.name} client={thread.client.name} compact />}
            trigger={<BarSummary title={`${styleLabel(thread.card.style, locale)} · ${placementLabel(thread.card.placement, locale)}`} status={bar.status} tone={bar.tone} placement={thread.card.placement} body={thread.card.body} tag={edited ? c.project.edited : undefined} />}
            t={t}
            locale={locale}
          />
          {bar.action && <BarAction {...bar.action} />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-5">
        <PushPrompt
          vapidKey={vapidKeys().publicKey}
          className="mb-4"
          labels={{ title: t.push.title, body: t.push.body, enable: t.push.enable, on: t.push.on, denied: t.push.denied, ios: t.push.ios }}
        />
        <ClientChat
          token={token}
          items={thread.items}
          names={{ client: thread.client.name, artist: thread.artist.name }}
          t={c}
          locale={locale}
          pinned={<RequestCard card={thread.card} t={t} locale={locale} artist={thread.artist.name} client={thread.client.name} />}
          project={<RequestCard card={thread.card} t={t} locale={locale} artist={thread.artist.name} client={thread.client.name} compact />}
          artistHref={`/${thread.artist.slug}`}
          justSent={justSent}
          balance={thread.balance}
          careLabels={{ download: t.care.download, from: t.care.from }}
          linkSuffix={fromStudio ? "?from=studio" : ""}
          direct={direct}
          demo={
            thread.demo && demo
              ? {
                  stage: demo.stage,
                  typing: demo.typing,
                  title: sc.introTitle,
                  intro: fill(sc.intro, { artist: thread.artist.name }),
                  hint: fill(sc.hints[demo.stage], { artist: thread.artist.name }),
                  typingLabel: fill(sc.typing, { artist: thread.artist.name }),
                  skip: sc.skip,
                  skipAction: skipDemoSession.bind(null, token),
                  again: { label: sc.again, href: `/${thread.artist.slug}/request` },
                  back: { label: fill(sc.back, { artist: thread.artist.name }), href: `/${thread.artist.slug}` },
                }
              : undefined
          }
        />
      </main>
      {fromStudio ? (
        <ArtistTabs slug={thread.artist.slug} labels={{ page: t.v2.tabs.page, chats: t.v2.tabs.chats, settings: t.v2.tabs.settings, bar: t.studio.nav.label }} />
      ) : (
        me && <ClientTabs labels={{ artists: t.v2.tabs.myArtists, messages: t.v2.tabs.messages, profile: t.v2.tabs.profile, bar: t.me.nav.label }} badge={unread} />
      )}
    </div>
  );
}
