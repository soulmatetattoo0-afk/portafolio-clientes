"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The bars at the thumb. The artist's: Mi página · Chats · Ajustes. The
 * client's: Página · Mensajes · Perfil. Both float over the page in ink glass,
 * the live one marked in the accent.
 */
type Item = { href: string; label: string; icon: "page" | "chats" | "settings" | "profile"; badge?: number; match?: (path: string) => boolean };

const ICON: Record<Item["icon"], React.ReactNode> = {
  page: <path d="M4 4.5h12v11H4zM4 9h12M9.5 9v6.5" />,
  chats: <path d="M3 5.5h14v9H8l-3.5 3v-3H3z" />,
  settings: <path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />,
  profile: <path d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.5c.7-3 3.1-5 6-5s5.3 2 6 5" />,
};

export function Tabs({ items, label }: { items: Item[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="v2-tabs">
      {items.map((it) => {
        const on = it.match ? it.match(path) : path === it.href || path.startsWith(`${it.href}/`);
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={`v2-tab ${on ? "is-on" : ""}`}>
            <span className="v2-tab-icon">
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICON[it.icon]}
              </svg>
              {it.badge ? <span className="v2-badge">{it.badge}</span> : null}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ArtistTabs({ slug, labels, badge }: { slug: string; labels: { page: string; chats: string; settings: string; bar: string }; badge?: number }) {
  return (
    <Tabs
      label={labels.bar}
      items={[
        { href: "/studio/pagina", label: labels.page, icon: "page", match: (p) => p.startsWith("/studio/pagina") || p.startsWith("/studio/obras") || p.startsWith("/studio/revista") || p === `/${slug}` || p.startsWith(`/${slug}/`) },
        { href: "/studio/chats", label: labels.chats, icon: "chats", badge },
        { href: "/studio/sala", label: labels.settings, icon: "settings", match: (p) => p.startsWith("/studio/sala") || p.startsWith("/studio/ajustes") },
      ]}
    />
  );
}

export function ClientTabs({ slug, labels, badge }: { slug: string | null; labels: { page: string; messages: string; profile: string; bar: string }; badge?: number }) {
  return (
    <Tabs
      label={labels.bar}
      items={[
        ...(slug ? [{ href: `/${slug}`, label: labels.page, icon: "page" as const, match: (p: string) => p === `/${slug}` || p.startsWith(`/${slug}/`) }] : []),
        { href: "/me", label: labels.messages, icon: "chats", badge, match: (p) => p === "/me" || p.startsWith("/me/briefs") || p.startsWith("/c/") },
        { href: "/me/perfil", label: labels.profile, icon: "profile" },
      ]}
    />
  );
}
