import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { monthYear } from "@/lib/format";
import { CURRENT_ISSUE, getIssue } from "@/lib/issue/current";

import { two } from "../chapters";
import { IssueReader } from "../IssueReader";

/** Only the issue on the newsstand exists until the archive has a table behind it. */
const numberOf = (raw: string) => (/^\d{1,3}$/.test(raw) ? Number(raw) : NaN);

export async function generateMetadata({ params }: PageProps<"/issue/[n]">): Promise<Metadata> {
  const { n } = await params;
  if (numberOf(n) !== CURRENT_ISSUE) return {};
  const { t, locale } = await getDict();
  const issue = await getIssue(locale);
  const title = `${BRAND.name} ${fill(t.world.issue.number, { n: two(issue.number) })} · ${issue.title}`;
  const images = issue.cover.image ? [issue.cover.image] : undefined;
  return {
    title: { absolute: title },
    description: issue.lead,
    openGraph: { title, description: issue.lead, type: "article", images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description: issue.lead, images },
  };
}

/**
 * An issue of the magazine, read sideways one chapter at a time. `?p=` opens
 * on a chapter, so a shared link lands on the page that was shared.
 */
export default async function IssuePage({ params, searchParams }: PageProps<"/issue/[n]">) {
  const [{ n }, sp] = await Promise.all([params, searchParams]);
  if (numberOf(n) !== CURRENT_ISSUE) notFound();
  const { t, locale } = await getDict();
  const issue = await getIssue(locale);
  const p = typeof sp.p === "string" ? sp.p : undefined;
  const initialKey = p && issue.stories.some((s) => s.id === p) ? p : undefined;

  return (
    <div className="poster relative h-dvh overflow-hidden" style={{ "--accent": issue.accent } as React.CSSProperties}>
      <div className="p-grain z-10" aria-hidden />
      <h1 className="sr-only">
        {BRAND.name} {fill(t.world.issue.number, { n: two(issue.number) })} · {issue.title}
      </h1>
      <IssueReader
        issue={{ number: issue.number, no: fill(t.world.issue.number, { n: two(issue.number) }), month: monthYear(issue.month, locale), title: issue.title, stories: issue.stories }}
        locale={locale}
        t={t.issue}
        appUrl={env.appUrl}
        initialKey={initialKey}
      />
    </div>
  );
}
