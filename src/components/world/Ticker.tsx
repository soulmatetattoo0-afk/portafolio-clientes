/**
 * A headline ticker, like the strip under a news desk: the issue's headlines
 * run across the page without end. Printed on bone, so the front page gets
 * a band of paper between the ink sections.
 */
export function Ticker({ items, label, href }: { items: string[]; label: string; href: string }) {
  if (!items.length) return null;
  const run = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <li key={`${hidden ? "b" : "a"}-${i}`} className="p-stamp flex items-center whitespace-nowrap text-ink">
          <span className="px-5 py-2.5">{it}</span>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        </li>
      ))}
    </ul>
  );
  return (
    <a href={href} aria-label={label} className="group relative block overflow-hidden border-y border-ink/20 bg-bone text-ink [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]">
      <div className="flex w-max animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {run(false)}
        {run(true)}
      </div>
    </a>
  );
}
