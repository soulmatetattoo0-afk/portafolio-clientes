import Link from "next/link";
import { redirect } from "next/navigation";

import { DemoBanner, Wordmark } from "@/components/Chrome";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { getMember, getSession } from "@/lib/auth";
import { live } from "@/lib/env";

import { enterDemo, enterSova } from "./actions";
import { AccountForm } from "../me/signin/AccountForm";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.studio.login.title, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  const sp0 = await searchParams;
  // Local mode and previews: straight into the demo studio, unless the point is to create a new page.
  if (!live.auth && sp0.mode !== "create") redirect("/studio/pagina");
  if (session && !session.implicit) {
    // Signed in at the artists' door: their studio, or the page they still have to set up.
    redirect((await getMember(session)) ? "/studio" : "/studio/onboarding");
  }
  const [{ t, locale }, sp] = await Promise.all([getDict(), searchParams]);
  const l = t.studio.login;
  return (
    <>
      <DemoBanner />
      <main className="grid flex-1 place-items-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <Link href="/artists" className="py-2">
              <Wordmark />
            </Link>
            <LangToggle
              locale={locale}
              label={t.common.language}
              title={t.common.languageLabel}
            />
          </div>
          <h1 className="t-title">{l.title}</h1>
          {sp.error === "link" && (
            <p role="alert" className="mt-4 text-oxblood">
              {l.invalid}
            </p>
          )}
          <p className="mt-3 mb-8 text-ash">{l.lead}</p>
          <AccountForm
            next="/studio"
            initial={sp.mode === "create" ? "create" : "enter"}
            askUsername={false}
            labels={{
              create: t.me.account.create,
              enter: t.me.account.enter,
              username: t.me.account.username,
              usernameHint: t.me.account.usernameHint,
              email: t.me.account.email,
              password: t.me.account.password,
              passwordHint: t.me.account.passwordHint,
              who: t.me.account.who,
              submitCreate: l.create,
              submitEnter: t.me.account.submitEnter,
              forgot: t.me.account.forgot,
            }}
          />
          {/* The demo studios: only on a laptop, never on a shared deployment. */}
          {!live.auth && !process.env.VERCEL && (
            <div className="mt-10 grid gap-3 border-t border-line pt-6">
              <p className="text-[0.9rem] text-ash">{l.demoLead}</p>
              <form action={enterDemo}>
                <button type="submit" className="btn btn-secondary w-full">
                  {l.demo}
                </button>
              </form>
              <form action={enterSova}>
                <button type="submit" className="btn btn-secondary w-full">
                  {l.demoSova}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
