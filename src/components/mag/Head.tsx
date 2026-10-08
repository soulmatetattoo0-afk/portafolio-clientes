/** A running head: the chapter kicker on the left, the folio on the right. */
export function Head({ kicker, folio, compact = false }: { kicker: string; folio: string; compact?: boolean }) {
  return (
    <p data-r className="flex items-baseline justify-between gap-3">
      <span className="p-gothic shrink-0 whitespace-nowrap text-[clamp(1rem,2.2cqw,1.5rem)] text-accent">{kicker}</span>
      <span className={`p-stamp min-w-0 truncate text-[clamp(0.5rem,2.4cqw,0.68rem)] opacity-50 ${compact ? "hidden @3xl:inline" : ""}`}>{folio}</span>
    </p>
  );
}
