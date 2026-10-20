import { redirect } from "next/navigation";

import { getDict } from "@/i18n/server";
import { getSession } from "@/lib/auth";

import { PasswordForm } from "../AccountForms";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.me.account.passwordTitle, robots: { index: false } };
}

/** Set a new password: from the settings of either side, or after a reset link. */
export default async function PasswordPage() {
  if (!(await getSession())) redirect("/me/signin?mode=enter&next=/account/password");
  const { t } = await getDict();
  const a = t.me.account;
  return (
    <>
      <div>
        <h1 className="p-display text-[clamp(2.6rem,12vw,3.8rem)] text-bone">{a.passwordTitle}</h1>
        <p className="mt-3 text-bone-dim">{a.passwordLead}</p>
      </div>
      <PasswordForm labels={{ password: a.newPassword, confirm: a.confirmPassword, hint: a.passwordHint, save: a.save }} />
    </>
  );
}
