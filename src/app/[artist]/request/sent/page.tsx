import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBanner, PublicBar } from "@/components/Chrome";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { getArtistBySlug } from "@/lib/queries";

export const metadata = { robots: { index: false } };

export default async function SentPage({ params, searchParams }: PageProps<"/[artist]/request/sent">) {
  const [{ artist: slug }, sp] = await Promise.all([params, searchParams]);
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  const { t } = await getDict();
  const s = t.brief.sent;
  const ref = typeof sp.ref === "string" && /^B-[A-Z0-9]{5}$/.test(sp.ref) ? sp.ref : null;
  return (
    <>
      <DemoBanner />
      <div className="poster flex flex-1 flex-col" style={{ ["--accent" as string]: artist.accent ?? "#d8552f" }}>
      <PublicBar>
        <Link href={`/${artist.slug}#deck`} className="p-stamp truncate py-2 text-bone">
          {artist.display_name.toUpperCase()}
        </Link>
      </PublicBar>
      <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-10 px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
        <div>
          <h1 className="p-display text-[clamp(2.6rem,11vw,4.5rem)]">{fill(s.title, { artist: artist.display_name })}</h1>
          {ref && <p className="p-stamp mt-4 text-accent">{fill(s.ref, { ref })}</p>}
        </div>
        <section aria-labelledby="next">
          <h2 id="next" className="t-heading mb-5">
            {s.next}
          </h2>
          <ol className="grid gap-5">
            {s.steps.map((line, i) => (
              <li key={line} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                <span className="p-display text-[1.8rem] leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span>{fill(line, { artist: artist.display_name })}</span>
              </li>
            ))}
          </ol>
        </section>
        <Link href={`/${artist.slug}#deck`} className="btn btn-primary w-fit">
          {fill(s.backToArtist, { artist: artist.display_name })}
        </Link>
      </main>
      </div>
    </>
  );
}
