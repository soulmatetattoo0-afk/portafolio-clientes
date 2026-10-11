"use client";

import { useEffect } from "react";

import { Thread } from "@/components/chat/Thread";
import { fill, type Dict, type Locale } from "@/i18n";
import type { ChatItem } from "@/lib/chat";

import { markClientRead, sendClientMessage } from "./actions";

export function ClientChat({ token, items, names, t, locale, pinned }: { token: string; items: ChatItem[]; names: { client: string; artist: string }; t: Dict["chat"]; locale: Locale; pinned: React.ReactNode }) {
  // The client writes once the artist has read the request and answered.
  const open = items.some((i) => i.actor === "artist");
  const count = items.length;
  useEffect(() => {
    void markClientRead(token);
  }, [token, count]);
  return (
    <Thread
      items={items}
      side="client"
      names={names}
      t={t}
      locale={locale}
      pinned={pinned}
      notice={fill(t.notice, { artist: names.artist })}
      waiting={open ? null : fill(t.waiting, { artist: names.artist })}
      onSend={(text) => sendClientMessage(token, text)}
    />
  );
}
