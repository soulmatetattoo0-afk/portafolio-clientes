"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="House" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={path.startsWith(item.href) ? "page" : undefined}
              className="flex min-h-10 items-center rounded-[var(--radius-sm)] px-3 text-[0.95rem] whitespace-nowrap text-ash transition-colors hover:text-vellum aria-[current=page]:bg-niche-2 aria-[current=page]:text-vellum lg:min-h-11"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
