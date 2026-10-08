import { BRAND } from "@/lib/brand";
import type { Locale } from "@/i18n";

/**
 * The issue on the newsstand. Until the first one is published it is the
 * bone card that says so; phase two fills it with the cover.
 */
export function IssueCard({ locale, labels }: { locale: Locale; labels: { kicker: string; number: string; coming: string; lead: string } }) {
  return (
    <section aria-label={`${BRAND.name} ${labels.number}`} className="relative overflow-hidden rounded-[18px] bg-bone px-5 py-6 text-ink">
      <span aria-hidden className="p-display pointer-events-none absolute -right-3 -bottom-6 text-[9rem] leading-none text-ink/[0.07] select-none">
        01
      </span>
      <p className="p-gothic text-[1.2rem] text-ink/70">{labels.kicker}</p>
      <p className="p-display mt-1 text-[clamp(3rem,16vw,5rem)] leading-[0.86]">
        {BRAND.name}
        <span className="block text-[0.42em] text-ink/80">
          {labels.number} · {labels.coming}
        </span>
      </p>
      <p className="mt-4 max-w-[36ch] text-[0.95rem] leading-snug text-ink/85">{labels.lead}</p>
      <p className="p-stamp mt-5 max-w-[40ch] text-[0.58rem] text-ink/60">{BRAND.editor[locale]}</p>
    </section>
  );
}
