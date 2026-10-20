import type { Metadata } from "next";
import Link from "next/link";

import { LangToggle } from "@/components/LangToggle";
import { VantaMark, VantaWord } from "@/components/brand/VantaLogo";
import { getDict } from "@/i18n/server";
import { getMember } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { DEMO_EMAIL, DEMO_USER_ID, live } from "@/lib/env";
import { getArtistById } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: { absolute: `${BRAND.name} · ${t.join.title}` }, description: t.join.lead };
}

/**
 * For now VANTA is each artist's own app: clients arrive through the link on
 * the artist's profile, so the front door only speaks to artists. The VANTA
 * world (search, the magazine, cities) waits at /lab/vanta.
 */
export default async function Home() {
  const { t, locale } = await getDict();
  const j = t.join;
  // Local mode and previews: two doors straight in, as the demo artist and as a client of theirs.
  const demo = !live.auth ? await getMember({ userId: DEMO_USER_ID, email: DEMO_EMAIL, verified: true }).then((m) => (m ? getArtistById(m.artistId) : null)) : null;
  return (
    <main className="poster relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16 text-center" style={{ ["--accent" as string]: "#c8231e" }}>
      <div className="p-grain" aria-hidden />
      <div className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)]">
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </div>
      <div className="relative grid max-w-md justify-items-center gap-5">
        <VantaMark className="h-14 w-auto text-bone" />
        <VantaWord className="h-4 w-auto text-bone" />
        <p className="p-stamp mt-6 text-accent">{j.stamp}</p>
        <h1 className="p-display text-[clamp(3rem,15vw,5.2rem)] leading-[0.88]">{j.title}</h1>
        <p className="text-[1rem] leading-relaxed text-bone/80">{j.lead}</p>
        {demo ? (
          <>
            <p className="p-stamp mt-3 text-bone/60">{j.demoLead}</p>
            <Link href="/studio" className="flex h-14 w-full items-center justify-center rounded-full bg-accent text-[1rem] font-semibold text-ink active:scale-[0.98]">
              {j.demoArtist.replace("{name}", demo.display_name)}
            </Link>
            <Link href={`/${demo.slug}`} className="flex h-14 w-full items-center justify-center rounded-full bg-bone text-[1rem] font-semibold text-ink active:scale-[0.98]">
              {j.demoClient}
            </Link>
            <Link href="/login?mode=create" className="mt-2 flex h-12 w-full items-center justify-center rounded-full border border-bone/30 text-[0.92rem] font-semibold">
              {j.cta}
            </Link>
          </>
        ) : (
          <>
            <Link href="/login?mode=create" className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-accent text-[1rem] font-semibold text-ink active:scale-[0.98]">
              {j.cta}
            </Link>
            <Link href="/login" className="flex h-12 w-full items-center justify-center rounded-full border border-bone/30 text-[0.92rem] font-semibold">
              {j.signIn}
            </Link>
          </>
        )}
        <p className="mt-4 text-[0.82rem] text-bone-dim">{j.note}</p>
      </div>
    </main>
  );
}
