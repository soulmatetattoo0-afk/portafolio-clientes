"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleCityFollow } from "@/app/me/actions";

/** Follow a city (for a trade): hear first when someone announces dates there. */
export function FollowCity({ city, trade = "tattoo", following, labels, className = "" }: { city: string; trade?: string; following: boolean | null; labels: { follow: string; following: string }; className?: string }) {
  const path = usePathname();
  const [on, setOn] = useState(Boolean(following));
  const [pending, start] = useTransition();
  if (following === null)
    return (
      <Link href={`/me/signin?next=${encodeURIComponent(path || "/")}`} className={`btn btn-accent ${className}`}>
        {labels.follow}
      </Link>
    );
  const click = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        const r = await toggleCityFollow(city, trade, path || "/");
        setOn(r.following);
      } catch {
        setOn(!next);
      }
    });
  };
  return (
    <button type="button" onClick={click} aria-pressed={on} disabled={pending} className={`btn ${on ? "btn-secondary" : "btn-accent"} ${className}`}>
      {on ? labels.following : labels.follow}
    </button>
  );
}
