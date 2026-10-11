import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LangToggle } from "@/components/LangToggle";
import { RequestCard } from "@/components/chat/RequestCard";
import { getDict } from "@/i18n/server";
import { PushPrompt } from "@/components/PushPrompt";
import { getChatByToken } from "@/lib/chat";
import { vapidKeys } from "@/lib/push";

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
export default async function ChatPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const thread = await getChatByToken(token);
  if (!thread) notFound();
  const { t, locale } = await getDict();
  const c = t.chat;
  const accent = thread.artist.accent ?? "#d8552f";

  return (
    <div className="poster min-h-dvh" style={{ ["--accent" as string]: accent }}>
      <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2.5">
          <Link href={`/${thread.artist.slug}#deck`} className="text-[1.3rem] leading-none text-bone" aria-label={thread.artist.name}>
            ←
          </Link>
          {thread.artist.portrait_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thread.artist.portrait_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="p-display truncate text-[1.35rem] leading-none">{thread.artist.name}</p>
            <p className="mt-1 truncate text-[0.78rem] text-bone-dim">{c.subtitle}</p>
          </div>
          <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
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
          pinned={<RequestCard card={thread.card} t={t} locale={locale} artist={thread.artist.name} />}
        />
      </main>
    </div>
  );
}
