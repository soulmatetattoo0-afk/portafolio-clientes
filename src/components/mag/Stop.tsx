/** One stop on a career line: the year and the city; `first` wears the accent. */
export function Stop({ year, label, first = false }: { year: string; label: string; first?: boolean }) {
  return (
    <li className="relative flex items-baseline gap-[2.5cqw] pl-[3.5cqw] @3xl:block @3xl:shrink-0 @3xl:border-t-2 @3xl:border-ink @3xl:pt-2 @3xl:pr-[3cqw] @3xl:pl-0">
      <span aria-hidden className={`absolute top-[0.35em] left-0 h-2 w-2 rounded-full @3xl:-top-[5px] ${first ? "bg-accent" : "bg-ink"}`} />
      <span className="p-stamp min-w-[6ch] shrink-0 text-[clamp(0.5rem,2.4cqw,0.68rem)] text-ink/60 @3xl:block @3xl:min-w-0">{year}</span>
      <span className="p-display truncate text-[clamp(1rem,5.2cqw,1.6rem)] text-ink @3xl:block @3xl:text-[1.6cqw]">{label}</span>
    </li>
  );
}
