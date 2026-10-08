import Link from "next/link";

import { dict, fill, type Locale } from "@/i18n";
import { BRAND } from "@/lib/brand";
import type { Issue } from "@/lib/issue/types";

/** The month an issue is dated, in words, capitalised the way the language likes it. */
export function issueMonth(month: Date, locale: Locale) {
  const s = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The issue on the newsstand: the cover small at the left, the masthead,
 * the number and the month, the first cover line. One tap opens it.
 */
export function IssueCard({ issue, locale, labels }: { issue: Issue; locale: Locale; labels: { kicker: string; number: string; inThis: string; read: string; lead: string } }) {
  const number = String(issue.number).padStart(2, "0");
  const line = dict(locale).issue.cover.lines[0];
  const cover = issue.cover;
  return (
    <Link href={`/issue/${issue.number}`} className="group flex gap-4 overflow-hidden rounded-[18px] bg-bone p-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone">
      <span className="relative block w-[6.5rem] shrink-0 self-start overflow-hidden rounded-[8px] bg-ink [aspect-ratio:2/3]">
        {cover.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.image} alt="" loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover ${cover.pos === "top" ? "object-top" : "object-center"}`} />
        ) : null}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
        <span aria-hidden className="p-display absolute top-1.5 left-2 text-[1.1rem] leading-none text-bone">{BRAND.name}</span>
        <span aria-hidden className="p-stamp absolute bottom-1.5 left-2 text-[0.45rem] text-bone/80">{fill(labels.number, { n: number })}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
        <span>
          <span className="p-gothic block text-[1.05rem] leading-none text-ink/70">{labels.kicker}</span>
          <span className="p-display mt-1 block text-[2.4rem] leading-[0.86]">{BRAND.name}</span>
          <span className="p-stamp mt-1.5 block text-[0.58rem] text-ink/70">
            {fill(labels.number, { n: number })} · {issueMonth(issue.month, locale)}
          </span>
          {line && <span className="p-quote mt-3 line-clamp-2 block text-[1.15rem] text-ink/90">{line}</span>}
        </span>
        <span className="p-stamp mt-4 block text-[0.6rem] text-ink group-hover:underline">{labels.read} →</span>
      </span>
    </Link>
  );
}
