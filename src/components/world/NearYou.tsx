"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setCity } from "@/app/actions/city";

/**
 * The head of the "near you" strip: where we think you are, the cities to
 * pick instead (a cookie, by slug), and the one button that asks the
 * browser for a location. Coordinates go into the URL, rounded, and
 * nowhere else.
 */
export function NearYou({
  title,
  place,
  current,
  located,
  cities,
  labels,
}: {
  title: string;
  /** The resolved place's name, or null when the location was used and nothing is close. */
  place: string;
  /** The slug of the city the strip is showing. */
  current: string | null;
  /** Whether the strip came from the URL's coordinates. */
  located: boolean;
  cities: { slug: string; city: string; n: number }[];
  labels: { cities: string; useLocation: string; locating: string; denied: string; seeAll: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (slug: string) => {
    setError(null);
    start(async () => {
      await setCity(slug);
      router.replace("/");
      router.refresh();
    });
  };

  const locate = () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(labels.denied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude.toFixed(2);
        const lng = pos.coords.longitude.toFixed(2);
        router.replace(`/?near=${lat},${lng}`);
      },
      () => {
        setLocating(false);
        setError(labels.denied);
      },
      { maximumAge: 600000, timeout: 10000 },
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="p-gothic text-[1.2rem] text-accent">{title}</p>
          <h2 className="p-display mt-0.5 truncate text-[clamp(2.4rem,11vw,3.4rem)] text-bone">{place}</h2>
        </div>
        {current && (
          <Link href={`/explore?city=${encodeURIComponent(current)}`} className="p-stamp shrink-0 py-3 text-bone-dim underline decoration-bone/30 underline-offset-4 hover:text-bone">
            {labels.seeAll}
          </Link>
        )}
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label={labels.cities}>
        <button type="button" className="chip shrink-0" aria-pressed={located} onClick={locate} disabled={locating || pending}>
          <span aria-hidden className="text-[0.9rem] leading-none">◎</span>
          {locating ? labels.locating : labels.useLocation}
        </button>
        {cities.map((c) => (
          <button key={c.slug} type="button" className="chip shrink-0" aria-pressed={!located && current === c.slug} onClick={() => pick(c.slug)} disabled={pending}>
            {c.city}
          </button>
        ))}
      </div>
      {error && (
        <p role="status" className="mt-2 text-[0.85rem] text-bone-dim">
          {error}
        </p>
      )}
    </div>
  );
}
