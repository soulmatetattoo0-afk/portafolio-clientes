import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { VantaMark } from "@/components/brand/VantaLogo";
import type { Dict, Locale } from "@/i18n";

export interface LegalDoc {
  title: string;
  updated: string;
  lead: string;
  sections: readonly { title: string; items: readonly string[] }[];
  contact: string;
}

/** A legal page as one sheet of VANTA paper, with the way to the other one at its foot. */
export function LegalSheet({ doc, other, t, locale }: { doc: LegalDoc; other: { href: string; label: string }; t: Dict; locale: Locale }) {
  return (
    <main className="poster min-h-dvh px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-10">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-1 pb-4">
        <VantaMark className="h-7 w-auto text-bone" />
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </div>
      <article className="relative mx-auto max-w-2xl overflow-hidden rounded-[6px] bg-[#f1ebdd] px-6 pt-8 pb-8 text-[#2b2420] shadow-[0_24px_40px_-18px_rgb(0_0_0/0.8)]">
        <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
        <div className="relative">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60">{doc.updated}</p>
          <h1 className="mt-2 font-[family-name:var(--font-cinzel)] text-[1.7rem] leading-[1.05] font-bold uppercase">{doc.title}</h1>
          <span aria-hidden className="mt-3 block h-px w-12 bg-[#c8231e]" />
          <p className="mt-4 text-[0.98rem] leading-relaxed text-[#2b2420]/85">{doc.lead}</p>
          <div className="mt-6 grid gap-5">
            {doc.sections.map((s) => (
              <section key={s.title}>
                <h2 className="text-[0.95rem] font-semibold">{s.title}</h2>
                <ul className="mt-1.5 grid gap-1.5 text-[0.95rem] leading-relaxed text-[#2b2420]/85">
                  {s.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-[#2b2420]/40" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-7 border-t border-[#2b2420]/15 pt-4 text-[0.88rem] text-[#2b2420]/70">{doc.contact}</p>
          <Link href={other.href} className="mt-3 inline-block text-[0.88rem] font-semibold underline underline-offset-4">
            {other.label} ›
          </Link>
        </div>
      </article>
    </main>
  );
}
