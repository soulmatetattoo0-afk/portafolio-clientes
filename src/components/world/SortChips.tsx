"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SortKey = "match" | "next" | "distance" | "newest";

/** How the results are ordered. Distance only exists once the search knows where you are. */
export function SortChips({ sort, hasNear, labels }: { sort: SortKey; hasNear: boolean; labels: { label: string; match: string; next: string; distance: string; newest: string } }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const keys: SortKey[] = hasNear ? ["match", "next", "distance", "newest"] : ["match", "next", "newest"];
  const pick = (k: SortKey) => {
    const p = new URLSearchParams(sp.toString());
    if (k === "match") p.delete("sort");
    else p.set("sort", k);
    p.delete("page");
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };
  return (
    <div className="seg max-w-full overflow-x-auto [scrollbar-width:none]" role="group" aria-label={labels.label}>
      {keys.map((k) => (
        <button key={k} type="button" className="shrink-0 whitespace-nowrap" aria-pressed={sort === k} onClick={() => pick(k)}>
          {labels[k]}
        </button>
      ))}
    </div>
  );
}
