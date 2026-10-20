"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { markArtistRead, sendArtistMessage } from "@/app/studio/_legacy/actions";
import { Thread } from "@/components/chat/Thread";
import { fill, type Dict, type Locale } from "@/i18n";
import type { ChatItem } from "@/lib/chat";

/**
 * The artist's side of the conversation: the thread, with the letter and its
 * actions on top. While a quote waits, the room checks back after half a
 * minute (in the demo the client books by then) and says so at the top.
 */
export function ArtistRoom({ briefId, items, names, t, careLabels, toast, waitingForClient, locale, pinned, project, afterPinned }: { briefId: string; items: ChatItem[]; names: { client: string; artist: string }; t: Dict["chat"]; careLabels: { download: string; from: string }; toast: string; waitingForClient: boolean; locale: Locale; pinned: React.ReactNode; project: React.ReactNode; afterPinned: React.ReactNode }) {
  const router = useRouter();
  const count = items.length;
  const paid = items.filter((i) => i.kind === "paid").length;
  const seenPaid = useRef(paid);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void markArtistRead(briefId);
  }, [briefId, count]);
  // The booking arrived since the last look: say it.
  useEffect(() => {
    if (paid > seenPaid.current) {
      setNote(fill(toast, { name: names.client }));
      const id = setTimeout(() => setNote(null), 8000);
      seenPaid.current = paid;
      return () => clearTimeout(id);
    }
    seenPaid.current = paid;
  }, [paid, toast, names.client]);
  useEffect(() => {
    if (!waitingForClient) return;
    const id = setTimeout(() => router.refresh(), 32000);
    return () => clearTimeout(id);
  }, [waitingForClient, router]);
  return (
    <>
      {note && (
        <div role="status" className="fixed inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-[90] rounded-[18px] bg-bone px-4 py-3 text-[0.95rem] font-semibold text-ink shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)]">
          {note}
        </div>
      )}
      <Thread items={items} side="artist" names={names} t={t} locale={locale} pinned={pinned} project={project} afterPinned={afterPinned} careLabels={careLabels} onSend={(text) => sendArtistMessage(briefId, text)} />
    </>
  );
}
