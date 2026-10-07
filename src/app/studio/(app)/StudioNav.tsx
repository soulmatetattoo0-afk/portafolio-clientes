"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function StudioNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/studio" ? path === "/studio" || path.startsWith("/studio/briefs") : path.startsWith(href));
  return (
    <nav aria-label="Studio" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 text-[0.95rem] whitespace-nowrap text-ash transition-colors hover:text-vellum aria-[current=page]:bg-niche-2 aria-[current=page]:text-vellum lg:min-h-11"
            >
              {item.label}
              {item.badge ? <span className="t-num rounded-full bg-gilt px-1.5 text-[0.72rem] font-semibold text-soot">{item.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
