import type { Metadata } from "next";
import Link from "next/link";

import { BottomTabs } from "@/components/world/BottomTabs";
import { WorldBar } from "@/components/world/WorldBar";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { monthYear } from "@/lib/format";
import { getIssue } from "@/lib/issue/current";

import { IssueCover, two } from "../issue/chapters";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.issue.archive.title, description: t.issue.archive.lead };
}

/** Every issue of the magazine, newest first: for now, the one on the newsstand. */
export default async function IssuesPage() {
  const { t, locale } = await getDict();
  const issue = await getIssue(locale);
  const a = t.issue.archive;
  const no = fill(t.world.issue.number, { n: two(issue.number) });
  const month = monthYear(issue.month, locale);
  const issues = [issue];

  return (
    <div className="poster relative min-h-dvh" style={{ "--accent": issue.accent } as React.CSSProperties}>
      <div className="p-grain" aria-hidden />
      <WorldBar />
      <main className="relative mx-auto w-full max-w-[1280px] px-4 pt-4 pb-20">
        <header>
          <p className="p-gothic text-[1.3rem] text-accent">{t.world.issue.kicker}</p>
          <h1 className="p-display mt-1 text-[clamp(3.4rem,17vw,7rem)] leading-[0.86] text-bone">{a.title}</h1>
          <p className="mt-3 max-w-[40ch] text-bone/80">{a.lead}</p>
        </header>
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {issues.map((i) => (
            <li key={i.number}>
              <Link href={`/issue/${i.number}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[6px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:-translate-y-1">
                  <IssueCover story={i.cover} no={no} month={month} t={t.issue} still />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="p-stamp text-bone-dim">
                      {BRAND.name} {no} · {month}
                    </p>
                    <p className="p-display mt-1 truncate text-[1.8rem] text-bone">{i.title}</p>
                  </div>
                  <span className="p-stamp shrink-0 text-accent">{a.read} →</span>
                </div>
                <p className="p-stamp mt-2 inline-block border border-accent px-2 py-1 text-[0.58rem] text-accent">{a.current}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <BottomTabs />
    </div>
  );
}
