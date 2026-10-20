import Link from "next/link";

import { saveProfile, signOutClient } from "@/app/me/actions";
import { LangToggle } from "@/components/LangToggle";
import { getDict } from "@/i18n/server";
import { listFollowed, requireClient } from "@/lib/client";

import { ProfileForm } from "./ProfileForm";

export const metadata = { robots: { index: false } };

/** Perfil: the artists the client follows (one tap to their page) and the few settings they have. */
export default async function ProfilePage() {
  const me = await requireClient("/me/perfil");
  const [{ t, locale }, followed] = await Promise.all([getDict(), listFollowed(me.userId)]);
  const m = t.v2.me;
  return (
    <div className="min-h-dvh">
      <header className="v2-top">
        <h1 className="p-display flex-1 text-[1.8rem] uppercase leading-none">{m.profile}</h1>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-3">
        <section>
          <p className="p-stamp text-bone/60">{m.following}</p>
          {followed.length === 0 ? (
            <p className="mt-2 text-bone-dim">{m.noFollowing}</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-3">
              {followed.map((a) => (
                <li key={a.id}>
                  <Link href={`/${a.slug}`} className="grid justify-items-center gap-2 text-center" style={{ ["--accent" as string]: a.accent ?? "#c8231e" }}>
                    <span className="p-display w-full truncate text-[0.95rem] uppercase leading-none">{a.display_name}</span>
                    {a.portrait_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.portrait_url} alt="" className="aspect-square w-full rounded-full object-cover ring-2 ring-accent" />
                    ) : (
                      <span className="grid aspect-square w-full place-items-center rounded-full bg-ink-2 p-display text-[2rem] text-accent">{a.display_name[0]}</span>
                    )}
                    <span className="text-[0.72rem] text-bone-dim">{a.home_city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="mt-8">
          <p className="p-stamp text-bone/60">{m.settings}</p>
          <ProfileForm me={{ name: me.name ?? "", email: me.email, locale: me.locale, homeCity: me.homeCity ?? "" }} labels={{ name: m.name, email: m.email, language: m.language, city: t.me.settings.homeCity, save: m.save, saved: m.saved, es: "Español", en: "English" }} action={saveProfile} />
        </section>
        <form action={signOutClient} className="mt-8 flex justify-end">
          <button type="submit" className="v2-btn" data-tone="ghost">
            {m.signOut}
          </button>
        </form>
      </main>
    </div>
  );
}
