import { redirect } from "next/navigation";

import { logout } from "@/app/login/actions";
import { Wordmark } from "@/components/Chrome";
import { getDict } from "@/i18n/server";
import { getMember, getSession } from "@/lib/auth";
import { COUNTRIES, TIMEZONES } from "@/lib/catalog";
import { env } from "@/lib/env";

import { OnboardingForm } from "./OnboardingForm";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.studio.onboarding.title, robots: { index: false } };
}

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await getMember(session)) redirect("/studio");
  const { t, locale } = await getDict();
  const o = t.studio.onboarding;
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-start gap-8 px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <Wordmark />
        <form action={logout}>
          <button type="submit" className="btn btn-ghost btn-sm">
            {t.common.signOut}
          </button>
        </form>
      </div>
      {env.allowedSignups.length > 0 && !env.allowedSignups.includes(session.email.toLowerCase()) ? (
        <p className="rounded-[var(--radius-md)] border border-ember/50 p-4 text-ember">{o.notInvited}</p>
      ) : (
        <OnboardingForm
          t={t}
          locale={locale}
          timezones={TIMEZONES}
          countries={COUNTRIES.map((c) => ({ code: c.code, label: c.label[locale], cities: c.cities }))}
        />
      )}
    </main>
  );
}
