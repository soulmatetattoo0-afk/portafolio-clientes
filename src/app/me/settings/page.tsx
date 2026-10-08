import { getDict } from "@/i18n/server";
import { requireClient } from "@/lib/client";

import { PageHead } from "../ui";
import { DeleteAccount, ProfileForm, SignOutButton } from "./SettingsForms";

export const metadata = { robots: { index: false } };

export default async function SettingsPage() {
  const me = await requireClient("/me/settings");
  const { t } = await getDict();
  const s = t.me.settings;
  return (
    <div className="grid gap-12">
      <PageHead title={s.title} />
      <section aria-labelledby="profile">
        <h2 id="profile" className="p-stamp mb-4 text-bone-dim">
          {s.profile}
        </h2>
        <ProfileForm
          me={{ name: me.name ?? "", email: me.email, locale: me.locale, homeCity: me.homeCity ?? "" }}
          labels={{ name: s.name, email: s.email, emailHint: s.emailHint, language: s.language, en: s.en, es: s.es, homeCity: s.homeCity, homeCityHint: s.homeCityHint, save: s.save, saved: s.saved }}
        />
      </section>
      <section aria-label={s.signOut}>
        <SignOutButton label={s.signOut} />
      </section>
      <section aria-labelledby="danger" className="rounded-[16px] border border-ember/40 p-5">
        <h2 id="danger" className="p-stamp mb-2 text-ember">
          {s.danger}
        </h2>
        <p className="mb-5 max-w-[44ch] text-[0.92rem] text-bone-dim">{s.dangerLead}</p>
        <DeleteAccount expected={me.name ?? me.email} labels={{ confirmLabel: s.confirmLabel, delete: s.delete, danger: s.danger }} />
      </section>
    </div>
  );
}
