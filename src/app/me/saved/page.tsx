import Link from "next/link";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { styleLabel } from "@/lib/catalog";
import { listFollowed, listSaved, requireClient } from "@/lib/client";
import { dateRange } from "@/lib/format";
import { placementLabel } from "@/lib/messages";

import { toggleFollow, toggleSave } from "../actions";
import { ToggleButton } from "../ToggleButton";
import { AccentDot, Empty, PageHead } from "../ui";

export const metadata = { robots: { index: false } };

export default async function SavedPage({ searchParams }: PageProps<"/me/saved">) {
  const me = await requireClient("/me/saved");
  const [{ t, locale }, sp, artists, pieces] = await Promise.all([getDict(), searchParams, listFollowed(me.userId), listSaved(me.userId)]);
  const s = t.me.saved;
  const tab = sp.tab === "pieces" ? "pieces" : "artists";
  const tabs = [
    { key: "artists", href: "/me/saved", label: `${s.artists} ${artists.length}` },
    { key: "pieces", href: "/me/saved?tab=pieces", label: `${s.pieces} ${pieces.length}` },
  ] as const;

  return (
    <>
      <PageHead title={s.title}>
        <div role="tablist" aria-label={s.title} className="mt-5 flex gap-2">
          {tabs.map((x) => (
            <Link key={x.key} href={x.href} role="tab" aria-selected={tab === x.key} className="chip" data-active={tab === x.key}>
              {x.label}
            </Link>
          ))}
        </div>
      </PageHead>

      {tab === "artists" ? (
        artists.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {artists.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3.5">
                <Link href={`/${a.slug}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <AccentDot accent={a.accent} />
                    <span className="p-display truncate text-[1.5rem] text-bone">{a.display_name}</span>
                  </span>
                  <span className="mt-0.5 block text-[0.9rem] text-bone-dim">
                    {a.home_city}
                    {a.next_stop ? `. ${fill(s.nextStop, { city: a.next_stop.city })}${a.next_stop.starts_on ? `, ${dateRange(a.next_stop.starts_on, a.next_stop.ends_on, locale)}` : ""}` : ""}
                  </span>
                  {a.accepting && <span className="p-stamp mt-1 block text-accent">{s.booking}</span>}
                </Link>
                <ToggleButton action={toggleFollow.bind(null, a.id, "/me/saved")} label={s.unfollow} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={s.noArtists} cta={{ href: "/explore", label: t.me.overview.findArtists }} />
        )
      ) : pieces.length ? (
        <ul className="grid grid-cols-2 gap-3">
          {pieces.map((p) => (
            <li key={p.id} className="grid content-start gap-2">
              <Link href={`/${p.artist_slug}`} className="block aspect-[4/5] overflow-hidden rounded-[12px] border border-line bg-ink-2" style={{ ["--accent" as string]: p.artist_accent ?? undefined }}>
                {p.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.url} alt={p.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="relative flex h-full items-end p-3">
                    <span className="p-halftone" aria-hidden />
                    <span className="p-display relative text-[1.6rem] leading-[0.9] text-accent">{p.title ?? styleLabel(p.style, locale)}</span>
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <p className="truncate text-bone">{p.title ?? placementLabel(p.placement ?? "", locale)}</p>
                <p className="truncate text-[0.85rem] text-bone-dim">{fill(s.by, { artist: p.artist_name })}</p>
              </div>
              <ToggleButton action={toggleSave.bind(null, p.id, "/me/saved?tab=pieces")} label={s.unsave} className="justify-self-start" />
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={s.noPieces} cta={{ href: "/explore", label: t.me.overview.findArtists }} />
      )}
    </>
  );
}
