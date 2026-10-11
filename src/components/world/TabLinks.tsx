"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3.5 9.5 10 4l6.5 5.5V16a.5.5 0 0 1-.5.5h-3.5v-4h-5v4H4a.5.5 0 0 1-.5-.5z" />,
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4.5 4.5" />
    </>
  ),
  chats: <path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" />,
  you: (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 17c.8-3.2 3.3-4.8 6.2-4.8s5.4 1.6 6.2 4.8" />
    </>
  ),
};

export function TabLinks({ tabs, label, unread, unreadLabel }: { tabs: { key: string; href: string; label: string; match: string[] }[]; label: string; unread: number; unreadLabel: string | null }) {
  const path = usePathname();
  // The most specific match wins: /me/briefs is Chats, the rest of /me is You.
  const active = tabs
    .map((tab) => ({ key: tab.key, len: Math.max(0, ...tab.match.filter((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m.endsWith("/") ? m : `${m}/`) || path === m)).map((m) => m.length)) }))
    .sort((a, b) => b.len - a.len)[0];
  const current = active && active.len > 0 ? active.key : null;
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {tabs.map((tab) => {
          const on = current === tab.key;
          return (
            <li key={tab.key}>
              <Link href={tab.href} aria-current={on ? "page" : undefined} className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold tracking-[0.06em] ${on ? "text-bone" : "text-bone-dim hover:text-bone"}`}>
                <svg aria-hidden viewBox="0 0 20 20" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[tab.key]}
                </svg>
                {tab.label}
                {tab.key === "chats" && unread > 0 && (
                  <span className="absolute top-2 left-[calc(50%+6px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[0.62rem] font-bold text-ink">
                    {unread}
                    <span className="sr-only">{unreadLabel}</span>
                  </span>
                )}
                {on && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-bone" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
