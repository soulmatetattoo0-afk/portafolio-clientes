"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFollow } from "@/app/me/actions";

/** Follow the artist: a small round button by their name. Signed out, it goes to sign in. */
export function FollowButton({ artistId, following, labels }: { artistId: string; following: boolean | null; labels: { follow: string; following: string } }) {
  const router = useRouter();
  const [on, setOn] = useState(Boolean(following));
  const [pending, start] = useTransition();
  if (following === null) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleFollow(artistId);
          setOn(r.following);
          router.refresh();
        })
      }
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${on ? "border-bone bg-bone text-ink" : "border-bone/30 text-bone"}`}
    >
      {on ? labels.following : labels.follow}
    </button>
  );
}
