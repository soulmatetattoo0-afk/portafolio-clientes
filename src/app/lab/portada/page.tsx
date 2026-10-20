import { notFound } from "next/navigation";

import { VantaWord } from "@/components/brand/VantaLogo";
import { getDict } from "@/i18n/server";
import { getIssue } from "@/lib/issue/current";
import type { Story } from "@/lib/issue/types";

/**
 * Four proposals for the front page of the magazine, side by side, so Camo
 * can pick one. A laptop-only page: nothing links here and it is not built
 * on the shared deployment.
 */

export const metadata = { title: "Portada · propuestas", robots: { index: false } };

const PLAYFAIR = { fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif' } as const;
const PHOTO = { portrait: "/demo/sova/portrait.webp", editorial: "/demo/sova/editorial.webp", studio: "/demo/sova/studio.webp", cover: "/demo/sova/cover.webp" };

interface Data {
  title: string;
  lead: string;
  stamp: string;
  artist: string;
  chapters: Story[];
}

/* 1 · Portada: the artist is the cover, the masthead across the top, the words only at the foot. */
function Portada({ d }: { d: Data }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-bone" style={PLAYFAIR}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.cover} alt="" className="absolute inset-0 h-full w-full object-cover object-[62%_30%]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-ink/75 via-ink/25 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-ink via-ink/85 to-transparent" />
      <div className="p-grain" aria-hidden />
      <div className="absolute inset-x-[5%] top-[3.5%]">
        <p className="text-[26cqw] leading-[0.82] font-black tracking-[-0.035em]">
          <span className="text-accent">V</span>ANTA
        </p>
        <div className="mt-[1.5cqw] flex items-end justify-between">
          <p className="font-sans text-[0.58rem] font-semibold tracking-[0.42em] text-bone/85">TATUAJE · ARTE · CULTURA</p>
          <p className="text-right text-[0.62rem] leading-tight tracking-[0.12em] text-bone/85 uppercase">
            No. 01 —<br />
            Octubre 2026
          </p>
        </div>
      </div>
      <div className="absolute inset-x-[5%] bottom-[7%] grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-end gap-4">
        <div>
          <p className="flex items-center gap-2 font-sans text-[0.6rem] font-semibold tracking-[0.36em] text-accent">
            EN PORTADA <span aria-hidden className="h-px w-10 bg-accent" />
          </p>
          <p className="mt-1 text-[19cqw] leading-[0.8] font-black tracking-[-0.03em]">SOVA</p>
          <p className="mt-2 text-[1.45rem] leading-[1.05] italic">{d.title}</p>
        </div>
        <dl className="grid gap-3 pb-2">
          {d.chapters.slice(0, 2).map((c) => (
            <div key={c.id}>
              <dt className="border-b border-accent/70 pb-0.5 text-[0.9rem] font-bold tracking-[0.04em] uppercase">{c.kicker}</dt>
              <dd className="mt-1 text-[0.82rem] leading-[1.15] text-bone/85 italic">{c.title}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="absolute inset-x-[5%] bottom-[2.6%] border-t border-bone/40 pt-2 text-center font-sans text-[0.55rem] font-semibold tracking-[0.4em] text-bone/80">
        ARTISTAS · MUSEOS · CONVENCIONES
      </p>
    </div>
  );
}

/* 2 · Pliego: a spread turned on its side: the ink page with the title, the photograph clean, the paper page with the index. */
function Pliego({ d }: { d: Data }) {
  const words = d.title.split(" ");
  const last = words.pop();
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-ink text-bone" style={PLAYFAIR}>
      <div className="relative px-5 pt-4 pb-4">
        <div className="p-grain" aria-hidden />
        <p className="flex items-center gap-3 font-sans text-[0.58rem] font-semibold tracking-[0.34em] text-bone/80">
          VANTA / ARTISTAS <span aria-hidden className="h-px flex-1 bg-bone/40" />
        </p>
        <p className="mt-3 text-[17cqw] leading-[0.86] font-black tracking-[-0.03em]">
          {words.join(" ")}
          <br />
          <span className="font-bold italic">{last}</span>
        </p>
        <p className="mt-3 flex items-center gap-3 font-sans text-[0.58rem] font-semibold tracking-[0.3em] text-accent">
          <span aria-hidden className="h-px w-8 bg-accent" /> 01 / LA EDICIÓN DE OCTUBRE
        </p>
      </div>
      <div className="relative h-[36%] shrink-0 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.editorial} alt="" className="h-full w-full object-cover object-[50%_35%]" />
      </div>
      <p className="px-5 pt-3 pb-4 text-[1.1rem] leading-[1.2] italic">{d.lead}</p>
      <div className="relative flex-1 bg-bone px-5 pt-4 text-ink">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-[0.55rem] font-semibold tracking-[0.34em] text-accent">EN EL ESTUDIO</p>
            <p className="text-[14cqw] leading-[0.8] font-black tracking-[-0.04em]">SOVA</p>
          </div>
          <div className="w-[46%] shrink-0 pt-1">
            <p className="border-b border-ink pb-1 font-sans text-[0.55rem] font-semibold tracking-[0.3em]">EN ESTA EDICIÓN</p>
            <ol className="mt-1.5 grid gap-1">
              {d.chapters.slice(0, 3).map((c, i) => (
                <li key={c.id} className="flex gap-2 text-[0.72rem] leading-tight">
                  <span className="shrink-0 text-accent tabular-nums">{String(i + 1).padStart(2, "0")} —</span>
                  <span className="truncate">{c.kicker}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="absolute right-5 bottom-3 font-sans text-[0.55rem] tracking-[0.2em] text-ink/60">02 · 03</p>
      </div>
    </div>
  );
}

/* 3 · Cartel: the poster face the app already has, but the words live on a paper band that never touches the face. */
function Cartel({ d }: { d: Data }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-bone">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.portrait} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_12%]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-ink/80 to-transparent" />
      <div className="p-grain" aria-hidden />
      <div className="absolute inset-x-5 top-4 flex items-center justify-between">
        <VantaWord className="h-[0.8rem] w-auto" />
        <p className="p-stamp text-[0.55rem] text-bone/85">{d.stamp}</p>
      </div>
      <p className="p-stamp absolute top-[26%] right-2 origin-right rotate-90 text-[0.55rem] whitespace-nowrap text-bone/90">EN PORTADA · {d.artist.toUpperCase()}</p>
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-bone text-ink [clip-path:polygon(0_14%,100%_0,100%_100%,0_100%)]">
        <div className="p-halftone opacity-30" aria-hidden />
        <div className="absolute inset-x-5 top-[22%] bottom-4 flex flex-col">
          <p className="p-gothic text-[1.2rem] leading-none text-accent">La revista VANTA</p>
          <p className="p-display mt-1 text-[16cqw] leading-[0.84]">{d.title}</p>
          <ol className="mt-auto grid gap-1 border-t border-ink/40 pt-2">
            {d.chapters.slice(0, 3).map((c, i) => (
              <li key={c.id} className="flex items-baseline gap-2 text-[0.78rem] leading-tight">
                <span className="p-display text-[0.9rem] text-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">{c.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* 4 · Lámina: paper, light, the photograph framed like a print on the table; the words below it in the house serif. */
function Lamina({ d }: { d: Data }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bone text-ink">
      <div className="p-grain" aria-hidden />
      <div className="flex items-center justify-between px-5 pt-5">
        <VantaWord className="h-[0.9rem] w-auto text-ink" />
        <p className="p-stamp text-[0.55rem] text-ink/60">{d.stamp}</p>
      </div>
      <figure className="relative mx-5 mt-4 shrink-0 border border-ink/80 bg-ink p-1.5 shadow-[0_30px_40px_-28px_rgb(0_0_0/0.8)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.cover} alt="" className="aspect-[4/3.9] w-full object-cover object-[50%_35%]" />
        <figcaption className="flex items-center justify-between px-1 pt-1.5 pb-0.5 font-sans text-[0.55rem] font-semibold tracking-[0.3em] text-bone/80 uppercase">
          <span>En portada · {d.artist}</span>
          <span>Manhattan</span>
        </figcaption>
      </figure>
      <div className="flex flex-1 flex-col px-5 pt-5 pb-5">
        <p className="p-stamp text-[0.55rem] text-accent">La revista VANTA · No. 01</p>
        <p className="mt-1 font-serif text-[15cqw] leading-[0.88] font-medium tracking-[-0.02em]">{d.title}</p>
        <p className="mt-3 font-serif text-[1.1rem] leading-[1.25] text-ink/80 italic">{d.lead}</p>
        <ol className="mt-5 grid gap-2.5 border-t border-ink pt-4">
          {d.chapters.slice(0, 3).map((c, i) => (
            <li key={c.id} className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-baseline gap-2">
              <span className="font-serif text-[1.1rem] text-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block font-sans text-[0.55rem] font-semibold tracking-[0.26em] text-ink/55 uppercase">{c.kicker}</span>
                <span className="block truncate font-serif text-[1.05rem] leading-tight">{c.title}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const VARIANTS = [
  { n: 1, name: "Portada", note: "La artista es la portada. Cabecera arriba, palabras solo al pie. Tipografía editorial (Playfair).", C: Portada },
  { n: 2, name: "Pliego", note: "Un pliego de revista puesto de pie: página de tinta con el título, la foto limpia, página de papel con el índice.", C: Pliego },
  { n: 3, name: "Cartel", note: "La cara de cartel que ya tiene la app, pero el texto vive en una banda de papel que nunca toca el rostro.", C: Cartel },
  { n: 4, name: "Lámina", note: "Papel y luz: la foto como una lámina enmarcada sobre la mesa, el título debajo en la serif de la casa.", C: Lamina },
];

export default async function CoverLab({ searchParams }: PageProps<"/lab/portada">) {
  if (process.env.VERCEL) notFound();
  const [{ locale }, sp] = await Promise.all([getDict(), searchParams]);
  const issue = await getIssue(locale);
  const d: Data = {
    title: issue.title,
    lead: issue.lead,
    stamp: `No. 01 · ${locale === "es" ? "Octubre 2026" : "October 2026"}`,
    artist: "TATTOO BY SOVA",
    chapters: issue.stories.filter((s) => s.kind === "news"),
  };
  const only = typeof sp.v === "string" ? Number(sp.v) : null;
  const list = only ? VARIANTS.filter((v) => v.n === only) : VARIANTS;
  return (
    <div className="poster min-h-dvh bg-ink text-bone" style={{ ["--accent" as string]: "#c8231e" }}>
      {/* The reference pages are set in a Didone; Playfair Display stands in for it here, from Google, lab only. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&display=swap" />
      {only ? (
        <div className="h-dvh w-full [container-type:inline-size]">{list.map(({ C, n }) => <C key={n} d={d} />)}</div>
      ) : (
        <div className="mx-auto max-w-[1700px] px-6 py-8">
          <h1 className="p-display text-[2.4rem]">Portada · 4 propuestas</h1>
          <p className="mt-1 text-bone-dim">Cada marco es un teléfono. Abre una sola a pantalla completa con ?v=1…4.</p>
          <ol className="mt-8 flex gap-8 overflow-x-auto pb-6">
            {list.map(({ C, n, name, note }) => (
              <li key={n} className="w-[375px] shrink-0">
                <p className="p-stamp text-accent">
                  0{n} · {name}
                </p>
                <p className="mt-1 min-h-[3.2rem] text-[0.85rem] leading-snug text-bone-dim">{note}</p>
                <div className="mt-3 h-[812px] w-[375px] overflow-hidden rounded-[28px] border border-line [container-type:inline-size]">
                  <C d={d} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
