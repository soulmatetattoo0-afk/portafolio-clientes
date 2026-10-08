"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The sections of the client's space, one scrolling row; the current one is underlined in the house accent. */
export function MeTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  if (pathname === "/me/signin") return null;
  return (
    <nav aria-label={label} className="relative z-10 border-b border-line">
      <ul className="mx-auto flex w-full max-w-2xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
        {tabs.map((tab) => {
          const active = tab.href === "/me" ? pathname === "/me" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`p-stamp -mb-px block border-b-2 px-2 py-3.5 transition-colors ${active ? "border-accent text-bone" : "border-transparent text-bone-dim hover:text-bone"}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
