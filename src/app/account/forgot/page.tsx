import Link from "next/link";

import { getDict } from "@/i18n/server";

import { ForgotForm } from "../AccountForms";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.me.account.forgotTitle, robots: { index: false } };
}

/** Getting back in: a link to the account's email. */
export default async function ForgotPage() {
  const { t } = await getDict();
  const a = t.me.account;
  return (
    <>
      <div>
        <h1 className="p-display text-[clamp(2.6rem,12vw,3.8rem)] text-bone">{a.forgotTitle}</h1>
        <p className="mt-3 text-bone-dim">{a.forgotLead}</p>
      </div>
      <ForgotForm labels={{ email: a.email, send: a.forgotSend }} />
      <Link href="/me/signin?mode=enter" className="p-stamp text-bone-dim underline underline-offset-4">
        {a.back}
      </Link>
    </>
  );
}
