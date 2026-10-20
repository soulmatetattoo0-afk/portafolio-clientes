import Link from "next/link";

/**
 * The guide: three steps on a band of the house colour, so anyone who
 * liked an artist knows what to do next. Each step is a door.
 */
export function HowItWorks({ folio, title, lead, steps }: { folio: string; title: string; lead: string; steps: { title: string; body: string; cta: string; href: string }[] }) {
  return (
    <section className="relative mt-16 overflow-hidden bg-accent text-ink md:mt-24" aria-labelledby="home-how-h">
      <div className="p-halftone opacity-20" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-12 md:py-16">
        <p className="p-stamp border-t border-ink/30 pt-3 text-ink/70">{folio}</p>
        <h2 id="home-how-h" className="p-display mt-3 max-w-[12ch] text-[clamp(2.6rem,12vw,5rem)] leading-[0.86]" data-reveal>
          {title}
        </h2>
        <p className="p-quote mt-3 max-w-[38ch] text-[clamp(1.15rem,4.4vw,1.5rem)] leading-[1.15] text-ink/85" data-reveal>
          {lead}
        </p>
        <ol className="mt-8 grid gap-3 md:grid-cols-3" data-reveal-group>
          {steps.map((s, i) => (
            <li key={s.title} className="group relative rounded-[18px] border border-ink/30 bg-ink/[0.06] p-5 transition-colors hover:bg-ink/10">
              <span aria-hidden className="p-display block text-[3.2rem] leading-[0.8] text-ink/30">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="p-display mt-3 text-[1.9rem] leading-[0.9]">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-snug text-ink/85">{s.body}</p>
              <Link href={s.href} className="p-stamp mt-4 inline-flex min-h-11 items-center gap-2 border-b-2 border-ink text-ink">
                {s.cta} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
