"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { fill, type Dict, type Locale } from "@/i18n";
import type { MyChat } from "@/lib/client";
import { relativeTime } from "@/lib/format";

/**
 * The way into the conversation from the artist's own page. The chat is born
 * with a quote request: with one chat the bubble opens it, with several it
 * lists them, and with none it explains how to unlock it.
 */
export function ChatBubble({ chats, artist, requestHref, onRequest, signInHref, t, locale }: { chats: MyChat[] | null; artist: string; requestHref: string; onRequest?: () => void; signInHref: string; t: Dict["artist"]["chats"]; locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const list = chats ?? [];
  const unread = list.filter((c) => c.unread).length;
  // A studio asks which artist first (a sheet on the same page); an artist's page goes to the request.
  const request = (className: string) =>
    onRequest ? (
      <button type="button" onClick={() => (setOpen(false), onRequest())} className={className}>
        {t.emptyCta}
      </button>
    ) : (
      <Link href={requestHref} className={className}>
        {t.emptyCta}
      </Link>
    );
  const press = () => (list.length === 1 ? router.push(`/c/${list[0].token}`) : setOpen(true));

  return (
    <>
      <button
        type="button"
        onClick={press}
        aria-label={fill(t.open, { artist })}
        className={`relative flex h-10 items-center gap-2 rounded-full border px-3.5 text-[0.8rem] font-semibold shadow-[0_10px_24px_-10px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur transition-transform active:scale-95 ${
          list.length ? "border-transparent bg-accent text-ink" : "border-bone/25 bg-ink-2/70 text-bone"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-[1.1rem] w-[1.1rem]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
          <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />
          {list.length > 0 && <path d="M8.5 10.75h.01M12 10.75h.01M15.5 10.75h.01" strokeLinecap="round" strokeWidth={2.6} />}
        </svg>
        {t.button}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-bone px-1 text-[0.62rem] font-bold text-ink">{unread}</span>
        )}
      </button>

      {/* Only ever open after a tap, so document exists. */}
      {open &&
        createPortal(
          <div className="poster fixed inset-0 z-50 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)} role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={fill(t.title, { artist })}
              onClick={(e) => e.stopPropagation()}
              className="animate-rise w-full max-w-[440px] rounded-t-[1.6rem] border border-line bg-ink-2 px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-bone sm:rounded-[1.6rem]"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-bone/20 sm:hidden" />
              {list.length ? (
                <>
                  <p className="p-stamp mb-3 text-bone/70">{fill(t.title, { artist })}</p>
                  <ul className="divide-y divide-line border-y border-line">
                    {list.map((c) => (
                      <li key={c.token}>
                        <Link href={`/c/${c.token}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5">
                          <span className="grid min-w-0 gap-0.5">
                            <span className={`truncate ${c.unread ? "font-semibold" : ""}`}>
                              {c.artist} · <span className="text-bone-dim">{c.ref}</span>
                            </span>
                            <span className="truncate text-[0.85rem] text-bone-dim">{c.waiting ? t.waiting : (c.lastBody ?? "")}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1 text-[0.72rem] text-bone-dim">
                            {relativeTime(c.lastAt, locale)}
                            {c.unread && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold text-ink">{t.newReply}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {request("mt-4 flex h-12 w-full items-center justify-center rounded-full border border-bone/30 text-[0.9rem] font-semibold")}
                </>
              ) : (
                <div className="grid justify-items-center gap-3 py-2 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-accent">
                    <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
                      <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />
                      <rect x="9.5" y="9" width="5" height="4.2" rx="0.6" />
                      <path d="M10.6 9V7.9a1.4 1.4 0 0 1 2.8 0V9" />
                    </svg>
                  </span>
                  <p className="p-display text-[1.7rem] leading-[0.95]">{fill(t.emptyTitle, { artist })}</p>
                  <p className="max-w-[18rem] text-[0.92rem] text-bone/80">{t.emptyBody}</p>
                  {request("mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent text-[0.95rem] font-semibold text-ink")}
                  {chats === null && (
                    <p className="text-[0.85rem] text-bone-dim">
                      {t.haveOne}{" "}
                      <Link href={signInHref} className="font-semibold text-bone underline underline-offset-4">
                        {t.signIn}
                      </Link>
                    </p>
                  )}
                </div>
              )}
              <button type="button" onClick={() => setOpen(false)} className="mt-3 h-11 w-full text-[0.85rem] text-bone-dim">
                {t.close}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
