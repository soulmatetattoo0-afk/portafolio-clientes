"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Back to the artist: when the client came from the artist's page, the
 * browser's own back (instant, keeps the place); otherwise a fresh visit.
 */
export function BackToArtist({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const onClick = (e: React.MouseEvent) => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const fromArtist = ref && ref.origin === window.location.origin && ref.pathname === `/${slug}`;
      if (fromArtist && window.history.length > 1) {
        e.preventDefault();
        router.back();
      }
    } catch {}
  };
  return (
    <Link href={`/${slug}`} onClick={onClick} className={className} prefetch>
      {children}
    </Link>
  );
}
