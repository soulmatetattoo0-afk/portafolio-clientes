import Link from "next/link";
import { redirect } from "next/navigation";

import { getDict } from "@/i18n/server";
import { getClientUser, safeNext } from "@/lib/client";
import { live } from "@/lib/env";

import { enterDemoClient } from "./actions";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function ClientSignInPage({ searchParams }: PageProps<"/me/signin">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getClientUser()) redirect(next);
  const { t } = await getDict();
  const s = t.me.signin;
  // The /me layout draws the poster root and the bar; this page is the form alone.
  return (
    <div className="mx-auto grid w-full max-w-md content-start gap-8 pt-4">
        <div>
          <h1 className="p-display text-[clamp(2.8rem,13vw,4.2rem)] text-bone">{s.title}</h1>
          <p className="p-quote mt-3 max-w-[34ch] text-[1.35rem] text-bone/85">{s.lead}</p>
        </div>
        {sp.error === "link" && (
          <p role="alert" className="rounded-[14px] border border-ember/50 px-4 py-3 text-[0.92rem] text-ember">
            {s.invalid}
          </p>
        )}
        {live.auth ? (
          <SignInForm next={next} labels={{ email: s.email, send: s.send, google: s.google, apple: s.apple, or: s.or }} />
        ) : (
          <form action={enterDemoClient} className="grid gap-4">
            <input type="hidden" name="next" value={next} />
            <p className="text-bone-dim">{s.demoLead}</p>
            <button type="submit" className="btn btn-primary w-full">
              {s.demo}
            </button>
          </form>
        )}
        <p className="mt-4 border-t border-line pt-5 text-[0.9rem] text-bone-dim">
          {s.forArtists}{" "}
          <Link href="/login" className="text-bone underline underline-offset-4">
            {s.forArtistsLink}
          </Link>
        </p>
    </div>
  );
}
