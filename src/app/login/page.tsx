import Link from "next/link";
import { redirect } from "next/navigation";

import { DemoBanner, Wordmark } from "@/components/Chrome";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { getMember, getSession } from "@/lib/auth";
import { getClientUser } from "@/lib/client";
import { live } from "@/lib/env";

import { enterDemo } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) {
    // A signed-in client without a studio of their own belongs in their space, not the onboarding.
    if (!(await getMember(session)) && (await getClientUser(session))) redirect("/me");
    redirect("/studio");
  }
  const [{ t, locale }, sp] = await Promise.all([getDict(), searchParams]);
  const l = t.studio.login;
  return (
    <>
      <DemoBanner />
      <main className="grid flex-1 place-items-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <Link href="/" className="py-2">
              <Wordmark />
            </Link>
            <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
          </div>
          <h1 className="t-title">{l.title}</h1>
          {sp.error === "link" && (
            <p role="alert" className="mt-4 text-oxblood">
              {l.invalid}
            </p>
          )}
          {live.auth ? (
            <>
              <p className="mt-3 mb-8 text-ash">{l.lead}</p>
              <LoginForm labels={{ email: l.email, send: l.send }} />
            </>
          ) : (
            <>
              <p className="mt-3 mb-8 text-ash">{l.demoLead}</p>
              <form action={enterDemo}>
                <button type="submit" className="btn btn-primary w-full">
                  {l.demo}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
