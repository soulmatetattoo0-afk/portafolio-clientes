import { redirect } from "next/navigation";

import { Wordmark } from "@/components/Chrome";
import { getDict } from "@/i18n/server";
import { getMember, getSession } from "@/lib/auth";
import { TIMEZONES } from "@/lib/catalog";
import { env } from "@/lib/env";

import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up", robots: { index: false } };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await getMember(session)) redirect("/studio");
  const { t } = await getDict();
  const o = t.studio.onboarding;
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-start gap-8 px-4 py-12 sm:px-6">
      <Wordmark />
      <div>
        <h1 className="t-title">{o.title}</h1>
        <p className="mt-2 text-ash">{o.lead}</p>
      </div>
      {env.allowedSignups.length > 0 && !env.allowedSignups.includes(session.email.toLowerCase()) ? (
        <p className="rounded-[var(--radius-md)] border border-ember/50 p-4 text-ember">{o.notInvited}</p>
      ) : (
        <OnboardingForm labels={{ name: o.name, slug: o.slug, slugHint: o.slugHint, city: o.city, timezone: o.timezone, create: o.create }} timezones={TIMEZONES} />
      )}
    </main>
  );
}
