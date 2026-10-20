import Link from "next/link";

import { VantaWord } from "@/components/brand/VantaLogo";
import type { Story } from "@/lib/issue/types";

/**
 * The front page opens on the issue: the cover photograph breathing behind
 * the masthead, the issue's title set huge in the house colour, and the
 * contents as a numbered list you can open chapter by chapter.
 */
export function IssueFront({
  image,
  pos,
  title,
  lead,
  stamp,
  href,
  inside,
  labels,
}: {
  image: string | null;
  pos: "top" | "center";
  title: string;
  lead: string;
  /** "No. 01 · October 2026" */
  stamp: string;
  href: string;
  inside: { story: Story; n: number }[];
  labels: { kicker: string; contents: string; read: string; open: string; folio: string };
}) {
  return (
    <section id="home-issue" className="relative -mt-[max(env(safe-area-inset-top),0.5rem)] overflow-hidden bg-ink text-bone" aria-labelledby="home-issue-h">
      {/* The photograph, slowly closing in, under a lot of ink. */}
      <div aria-hidden className="absolute inset-0">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className={`absolute inset-0 h-full w-full origin-[60%_30%] animate-kenburns object-cover opacity-70 motion-reduce:animate-none ${pos === "top" ? "object-top" : "object-center"}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/30 to-ink" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-transparent to-transparent" />
        <div className="p-halftone" />
      </div>

      <div className="relative mx-auto flex min-h-[88svh] w-full max-w-[1280px] flex-col px-4 pt-[calc(env(safe-area-inset-top)+4.2rem)] pb-10 lg:min-h-[80vh] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16 lg:pb-16">
        <div className="flex flex-1 flex-col justify-end lg:justify-end">
          <p className="p-stamp flex items-center justify-between gap-3 border-b border-bone/30 pb-2 text-bone/80">
            <span>{labels.folio}</span>
            <span>{stamp}</span>
          </p>
          <p className="p-gothic mt-5 text-[clamp(1.3rem,5.5vw,1.9rem)] text-accent" data-reveal>
            {labels.kicker}
          </p>
          <h2 id="home-issue-h" className="p-display mt-1 text-[clamp(3.4rem,17vw,8.5rem)] leading-[0.84] text-bone" data-reveal>
            {title}
          </h2>
          <p className="p-quote mt-4 max-w-[36ch] text-[clamp(1.2rem,4.6vw,1.7rem)] leading-[1.15] text-bone/90" data-reveal>
            {lead}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3" data-reveal>
            <Link href={href} className="btn btn-accent">
              {labels.read} →
            </Link>
            <VantaWord className="h-[0.7rem] w-auto text-bone/70" />
          </div>
        </div>

        <ol className="mt-10 border-t border-bone/30 lg:mt-0" aria-label={labels.contents} data-reveal-group>
          {inside.map(({ story, n }) => (
            <li key={story.id} className="border-b border-bone/20">
              <Link href={`${href}?p=${story.id}`} className="group flex min-h-[4.6rem] items-center gap-4 py-3">
                <span aria-hidden className="p-display w-9 shrink-0 text-[1.7rem] leading-none text-accent tabular-nums">
                  {String(n).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="p-stamp block truncate text-[0.58rem] text-bone/60">{story.kicker}{story.place ? ` · ${story.place}` : ""}</span>
                  <span className="p-display mt-1 line-clamp-2 block text-[clamp(1.25rem,5vw,1.6rem)] leading-[0.92] text-bone group-hover:text-accent">{story.title}</span>
                </span>
                <span aria-hidden className="p-stamp shrink-0 text-[0.58rem] text-bone/50 transition-transform group-hover:translate-x-0.5">
                  {labels.open} →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
