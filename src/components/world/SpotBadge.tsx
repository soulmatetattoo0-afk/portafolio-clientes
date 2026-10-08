import { dateRange } from "@/lib/format";
import type { Locale } from "@/i18n";

/** "Miami / Oct 26 – Nov 1": the next guest spot, when it is close. Two short lines so it fits a narrow card. */
export function SpotBadge({ city, start, end, locale, className = "" }: { city: string; start: string | null; end: string | null; locale: Locale; className?: string }) {
  return (
    <span className={`inline-flex max-w-full flex-col rounded-[10px] bg-bone px-2 py-1 leading-tight text-ink ${className}`}>
      <span className="p-stamp flex items-center gap-1.5 text-[0.55rem] tracking-[0.18em]">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="truncate">{city}</span>
      </span>
      {start && <span className="p-gothic text-[0.9rem] leading-none">{dateRange(start, end, locale)}</span>}
    </span>
  );
}
