"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Thread } from "@/components/chat/Thread";
import { fill, type Dict, type Locale } from "@/i18n";
import type { Balance } from "@/lib/balance";
import type { ChatItem } from "@/lib/chat";
import { money } from "@/lib/format";

import { markClientRead, payBalance, sendClientMessage } from "./actions";

export function ClientChat({ token, items, names, t, locale, pinned, project, artistHref, justSent, balance, careLabels, linkSuffix = "", direct = false }: { direct?: boolean; token: string; items: ChatItem[]; names: { client: string; artist: string }; t: Dict["chat"]; locale: Locale; pinned: React.ReactNode; project?: React.ReactNode; artistHref: string; justSent: boolean; balance: Balance | null; careLabels?: { download: string; from: string }; linkSuffix?: string }) {
  // The client writes once the artist has read the request and answered.
  const open = items.some((i) => i.actor === "artist");
  const count = items.length;
  // The house's note arrives as a notification right after sending (the list of quotes shows it too).
  const [toast, setToast] = useState(justSent);
  useEffect(() => {
    void markClientRead(token);
  }, [token, count]);
  return (
    <>
      {toast && (
        <div role="status" className="animate-rise fixed inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-40 mx-auto max-w-md rounded-[20px] border border-bone/15 bg-ink/95 p-4 text-bone shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8)] backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="p-stamp text-[0.6rem] text-bone/70">{t.noticeTitle}</p>
              <p className="mt-1 text-[0.92rem] leading-snug">{fill(t.notice, { artist: names.artist })}</p>
            </div>
            <button type="button" onClick={() => setToast(false)} className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bone/70 hover:text-bone" aria-label={t.dismiss}>
              ×
            </button>
          </div>
          <Link href={artistHref} className="mt-3 flex h-11 items-center justify-between rounded-full bg-bone px-4 text-[0.88rem] font-semibold text-ink">
            {fill(t.backToProfile, { artist: names.artist })}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      )}
      {balance && !balance.paid && balance.requested && direct && (
        <p className="mb-3 rounded-[16px] border border-bone/15 bg-ink-2 px-4 py-3 text-[0.92rem] leading-snug text-bone/85">
          {fill(t.direct.balanceAmount, { artist: names.artist, amount: balance.amountCents !== null ? money(balance.amountCents, balance.currency, locale) : "" })}
          <span className="mt-1 block text-[0.82rem] text-bone-dim">{fill(t.direct.balance, { artist: names.artist })}</span>
        </p>
      )}
      {balance && !balance.paid && !direct && <PayBalance token={token} balance={balance} t={t.balance} artist={names.artist} locale={locale} />}
      <Thread
      items={items}
      side="client"
      names={names}
      t={t}
      locale={locale}
      pinned={pinned}
      project={project}
      waiting={open ? null : fill(t.waiting, { artist: names.artist })}
      chatToken={token}
      careLabels={careLabels}
      linkSuffix={linkSuffix}
      onSend={(text) => sendClientMessage(token, text)}
    />
    </>
  );
}

/**
 * The rest of the tattoo. Before the session: a quiet line saying the button
 * comes on the day. Once it has started: one red key that takes the client to
 * pay the amount the artist set, straight to the artist.
 */
function PayBalance({ token, balance, t, artist, locale }: { token: string; balance: Balance; t: Dict["chat"]["balance"]; artist: string; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!balance.open) return <p className="mb-3 text-center text-[0.85rem] text-bone-dim">{t.upcoming}</p>;
  if (balance.amountCents === null) return <p className="mb-3 rounded-[16px] border border-line px-4 py-3 text-center text-[0.9rem] text-bone-dim">{fill(t.waiting, { artist })}</p>;
  const pay = () =>
    start(async () => {
      setError(null);
      const res = await payBalance(token);
      if ("error" in res) setError(res.error);
      else if (res.url.startsWith("http")) window.location.assign(res.url);
      else {
        // Walking the client's side from the studio: keep the artist's bar.
        router.push(window.location.search.includes("from=studio") ? `${res.url}?from=studio` : res.url);
        router.refresh();
      }
    });
  return (
    <div className="mb-4 grid gap-2 rounded-[20px] border border-bone/15 bg-ink-2 p-4">
      <p className="text-[0.92rem] leading-snug text-bone/85">{fill(t.lead, { artist })}</p>
      <button type="button" onClick={pay} disabled={pending} className="p-key h-[76px] w-full" data-down={pending} aria-label={fill(t.payAmount, { amount: money(balance.amountCents, balance.currency, locale) })}>
        <span className="p-key-side" aria-hidden />
        <span className="p-key-cap" aria-hidden>
          <span className="p-key-word p-display px-3 text-center text-[1.25rem] leading-[0.95]">{fill(t.payAmount, { amount: money(balance.amountCents, balance.currency, locale) })}</span>
        </span>
      </button>
      {error && <p role="alert" className="text-[0.85rem] text-ember">{error}</p>}
    </div>
  );
}
