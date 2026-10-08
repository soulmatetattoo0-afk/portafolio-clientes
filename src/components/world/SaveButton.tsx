"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFollow } from "@/app/me/actions";

/**
 * The bookmark on a card or a page. Signed out it is a link into sign-in
 * with a way back; signed in it follows or unfollows at once and settles
 * on what the server says.
 */
export function SaveButton({
  artistId,
  following,
  labels,
  className = "",
}: {
  artistId: string;
  /** null: signed out. */
  following: boolean | null;
  labels: { save: string; saved: string; signIn: string };
  className?: string;
}) {
  const path = usePathname();
  const [on, setOn] = useState(Boolean(following));
  const [pending, start] = useTransition();
  const base = `inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${className}`;

  if (following === null)
    return (
      <Link href={`/me/signin?next=${encodeURIComponent(path || "/")}`} className={`${base} border-bone/30 bg-ink/60 text-bone backdrop-blur-sm hover:border-bone`} title={labels.signIn} aria-label={labels.signIn}>
        <Mark filled={false} />
      </Link>
    );

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        const r = await toggleFollow(artistId, path || "/");
        setOn(r.following);
      } catch {
        setOn(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={pending}
      title={on ? labels.saved : labels.save}
      aria-label={on ? labels.saved : labels.save}
      className={`${base} ${on ? "border-accent bg-accent text-ink" : "border-bone/30 bg-ink/60 text-bone backdrop-blur-sm hover:border-bone"}`}
    >
      <Mark filled={on} />
    </button>
  );
}

function Mark({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M5 3.5h10v13l-5-3.2-5 3.2z" />
    </svg>
  );
}
