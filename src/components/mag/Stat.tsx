/** A big number and what it counts, on a bone page. */
export function Stat({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-baseline gap-[2.5cqw] border-b border-ink/20 py-[1.1cqh]">
      <span className="p-display text-[clamp(1.8rem,9.5cqw,3.4rem)] leading-none text-ink @3xl:text-[3.2cqw]">{n}</span>
      <span className="p-stamp text-[clamp(0.5rem,2.4cqw,0.68rem)] text-ink/60">{label}</span>
    </li>
  );
}
