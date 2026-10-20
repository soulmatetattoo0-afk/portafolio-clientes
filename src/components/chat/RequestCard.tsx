import { fill, type Dict, type Locale } from "@/i18n";
import type { ChatCard } from "@/lib/chat";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { cmLabel, moneyRange, prettyDates } from "@/lib/format";
import { PAIN_LABELS, PAIN_LEVELS, PLACEMENT_BY_SLUG, painFor } from "@/mannequin/catalog";

import { VantaMark } from "@/components/brand/VantaLogo";

import { BodyChart, chartViews } from "./BodyChart";
import { CardDialog } from "./CardDialog";
import { Figure3D } from "./Figure3D";

const INK = "#2b2420";
const cinzel = "font-[family-name:var(--font-cinzel)]";
const cormorant = "font-[family-name:var(--font-cormorant)]";
const script = "font-[family-name:var(--font-script)]";

/**
 * The client's request as one letter on VANTA paper, the same in every place
 * it shows: pinned at the top of the chat (the style, the area drawn on an
 * engraved body plate, the idea, the references, the client's signature),
 * opened full over the chat with every detail, and as one line inside a
 * booking confirmation. The artist can also turn the 3D figure on inside it.
 */
export function RequestCard({
  card,
  t,
  locale,
  artist,
  client,
  compact = false,
  figure = false,
  bar,
}: {
  /** Pinned under the name as the chat scrolls: this slim bar opens the letter. */
  bar?: React.ReactNode;
  card: ChatCard;
  t: Dict;
  locale: Locale;
  artist: string;
  /** Who signs the letter. */
  client?: string;
  open?: boolean;
  /** One line inside a booking confirmation instead of the whole letter. */
  compact?: boolean;
  /** Offer the 3D figure inside the opened letter (the artist's side). */
  figure?: boolean;
}) {
  const c = t.chat.card;
  const placement = PLACEMENT_BY_SLUG.get(card.placement);
  const where = placement?.label[locale] ?? card.placement;
  const style = styleLabel(card.style, locale);
  const pain = painFor(card.placement);
  const size = card.full_coverage ? t.studio.brief.fullCoverage : cmLabel(card.size_w_cm, card.size_h_cm);
  const timing = card.timing === "specific" && card.preferred_dates ? prettyDates(card.preferred_dates, locale) : t.brief.timing[card.timing];
  const views = chartViews(card.placement);
  const sent = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(card.created_at));
  const viewLabels = { front: c.front, back: c.back };

  return (
    <CardDialog
      label={c.pinned}
      className={
        bar
          ? "min-w-0 flex-1 text-left"
          : compact
          ? `group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-[6px] border border-[#2b2420]/15 bg-[#f3ecdf] py-2 pr-3 pl-2 text-left text-[#2b2420] transition-transform active:scale-[0.98]`
          : `group relative block w-full overflow-hidden rounded-[6px] bg-[#f3ecdf] text-left text-[#2b2420] shadow-[0_26px_44px_-20px_rgb(0_0_0/0.85)] transition-transform active:scale-[0.985]`
      }
      dialogClassName={`m-auto max-h-[90dvh] w-[min(30rem,calc(100vw-1.25rem))] overflow-y-auto overscroll-contain rounded-[8px] bg-[#f3ecdf] p-0 text-[#2b2420] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] backdrop:bg-black/75 backdrop:backdrop-blur-sm`}
      trigger={
        bar ? (
          bar
        ) : compact ? (
          <>
            <BodyChart placement={card.placement} body={card.body} views={[views[0] ?? "front"]} className="w-7 shrink-0" />
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block truncate text-[0.9rem] font-semibold">
                {style} · {where}
              </span>
              <span className={`block truncate text-[0.78rem] text-[#2b2420]/65`}>{[card.ref, card.city, timing].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="shrink-0 text-[0.75rem] font-semibold group-hover:underline">{c.compact} ›</span>
          </>
        ) : (
          <>
            <span className="p-grain" aria-hidden style={{ opacity: 0.35 }} />
            <span aria-hidden className="absolute inset-x-5 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
            <span className="relative block px-5 pt-5 pb-4">
              <span className={`flex items-baseline justify-between gap-3 text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-[#2b2420]/60`}>
                <span>{c.pinned}</span>
                <span>Nº {card.ref}</span>
              </span>
              <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <span className="min-w-0">
                  <span className={`${cinzel} block text-[1.4rem] leading-[1.05] font-bold uppercase tracking-[0.02em]`}>{style}</span>
                  <span className={`${cormorant} mt-0.5 block text-[1.2rem] leading-tight italic`}>{where}</span>
                  <span aria-hidden className="mt-2.5 block h-px w-10" style={{ background: "var(--accent)" }} />
                  <span className={`mt-2.5 block text-[0.78rem] leading-snug text-[#2b2420]/70`}>
                    {[size, colorLabel(card.color_mode, locale)].filter(Boolean).join(" · ")}
                    <span className="block">{[card.city, timing].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
                <BodyChart placement={card.placement} body={card.body} views={views.length ? views : ["front"]} className={views.length > 1 ? "w-[6.4rem] gap-1.5" : "w-[3.4rem]"} />
              </span>
              {card.description && <span className={`${cormorant} mt-3 line-clamp-3 block text-[1.08rem] leading-snug italic text-[#2b2420]/90`}>“{card.description}”</span>}
              {card.files.length > 0 && (
                <span className="mt-3 flex gap-2.5">
                  {card.files.slice(0, 3).map((f, i) => (
                    <Print key={f.id} url={f.url} tilt={[-2.5, 1.5, -1][i]} className="h-[4.4rem] w-[3.6rem]" />
                  ))}
                  {card.files.length > 3 && <span className={`self-end text-[0.75rem] text-[#2b2420]/60`}>+{card.files.length - 3}</span>}
                </span>
              )}
              <Perforation />
              <span className="flex items-end justify-between gap-3">
                <span className="min-w-0">
                  {client && <span className={`${script} block overflow-hidden py-1 pl-2 text-[1.7rem] leading-none text-ellipsis whitespace-nowrap`}>{client}</span>}
                  <span className="mt-1.5 block text-[0.75rem] font-semibold group-hover:underline">{c.open} ›</span>
                </span>
                <Seal className="h-12 w-12" />
              </span>
            </span>
          </>
        )
      }
    >
      <article className="relative">
        <span className="p-grain" aria-hidden style={{ opacity: 0.3 }} />
        <span aria-hidden className="absolute inset-x-6 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
        <button type="button" data-close className={`absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[1.4rem] text-[#2b2420]/70 hover:bg-[#2b2420]/5`} aria-label={t.common.close}>
          ×
        </button>
        <div className="relative px-6 pt-7 pb-7">
          <p className={`text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60`}>
            {c.pinned} · Nº {card.ref}
          </p>
          <p className={`mt-1 text-[0.8rem] text-[#2b2420]/65`}>
            {fill(c.to, { artist })} · {sent}
          </p>
          <h2 className={`${cinzel} mt-4 text-[1.9rem] leading-[1.02] font-bold uppercase tracking-[0.02em]`}>{style}</h2>
          <p className={`${cormorant} text-[1.45rem] leading-tight italic`}>{where}</p>
          <span aria-hidden className="mt-3 block h-px w-12" style={{ background: "var(--accent)" }} />

          {/* The plate: the body engraved front and back, the area in the artist's colour. */}
          <figure className={`mt-5 rounded-[4px] border border-[#2b2420]/25 p-1`}>
            <div className={`rounded-[2px] border border-[#2b2420]/15 px-4 pt-4 pb-3`}>
              <BodyChart placement={card.placement} body={card.body} labels={viewLabels} className="mx-auto max-w-[16rem]" />
              <figcaption className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#2b2420]/15 pt-2.5 text-[0.75rem]`}>
                <span className="font-semibold uppercase tracking-[0.14em]">
                  {where} · {size}
                </span>
                <span className="flex items-center gap-1.5" title={c.pain}>
                  <span className={`text-[#2b2420]/60`}>{c.pain}</span>
                  <span className="flex items-end gap-[2px]" aria-hidden>
                    {PAIN_LEVELS.map((p, i) => (
                      <span key={p} className="w-[5px] rounded-[1px]" style={{ height: 6 + i * 3, background: i <= PAIN_LEVELS.indexOf(pain) ? "var(--accent)" : `${INK}26` }} />
                    ))}
                  </span>
                  <span className="font-semibold">{PAIN_LABELS[pain][locale]}</span>
                </span>
              </figcaption>
            </div>
          </figure>

          {figure && placement && (
            <div className="mt-4">
              <Figure3D
                labels={{ show: c.view3d, hide: c.hide3d }}
                body={card.body}
                heightCm={card.body === "f" ? 167 : 178}
                placement={card.placement}
                widthCm={card.size_w_cm}
                heightCmDesign={card.size_h_cm}
                label={where}
                front={t.brief.placement.front}
                back={t.brief.placement.back}
              />
            </div>
          )}

          {/* The idea, in the client's words. */}
          <section className="mt-6">
            <p className={`text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60`}>{c.idea}</p>
            <p className={`${cormorant} mt-2 text-[1.25rem] leading-[1.45] whitespace-pre-line italic`}>{card.description}</p>
            {card.avoid && (
              <p className="mt-4 border-l-2 pl-3 text-[0.92rem] leading-snug whitespace-pre-line" style={{ borderColor: "var(--accent)" }}>
                <span className={`block text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60`}>{c.avoid}</span>
                {card.avoid}
              </p>
            )}
          </section>

          {/* The particulars, set like a ledger. */}
          <dl className="mt-6 grid gap-2 text-[0.9rem]">
            <Ledger label={c.style}>
              {style}, {colorLabel(card.color_mode, locale).toLowerCase()}
            </Ledger>
            <Ledger label={c.size}>{size}</Ledger>
            <Ledger label={c.figure}>{card.body === "f" ? t.brief.placement.female : t.brief.placement.male}</Ledger>
            <Ledger label={c.city}>{card.city ?? "—"}</Ledger>
            <Ledger label={c.when}>{timing}</Ledger>
            <Ledger label={c.budget}>{moneyRange(card.budget_min_cents, card.budget_max_cents, card.currency, locale) || "—"}</Ledger>
            {(card.is_coverup || card.is_first_tattoo) && (
              <Ledger label={c.notes}>{[card.is_coverup ? t.studio.brief.coverup : null, card.is_first_tattoo ? t.studio.brief.firstTattoo : null].filter(Boolean).join(" · ")}</Ledger>
            )}
          </dl>

          {card.files.length > 0 && (
            <section className="mt-6">
              <p className={`text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60`}>{c.refs}</p>
              <ul className="mt-3 grid grid-cols-3 gap-3">
                {card.files.map((f, i) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="block">
                      <Print url={f.url} tilt={[-2, 1.5, -1, 2, -1.5, 1][i % 6]} className="aspect-[4/5] w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Perforation />
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60`}>{c.from}</p>
              {client && <p className={`${script} mt-1 overflow-hidden py-1 pl-2 text-[2.1rem] leading-none text-ellipsis whitespace-nowrap`}>{client}</p>}
            </div>
            <Seal className="h-16 w-16" />
          </div>
        </div>
      </article>
    </CardDialog>
  );
}

/** A reference photo pinned to the letter like a print, with a strip of tape. */
function Print({ url, tilt, className }: { url: string; tilt: number; className: string }) {
  return (
    <span className={`relative block shrink-0 bg-white p-[3px] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.55)] ${className}`} style={{ transform: `rotate(${tilt}deg)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-8 -translate-x-1/2 rotate-[-4deg] bg-[#e9dcc0]/80" />
    </span>
  );
}

/** The tear line across the letter. */
function Perforation() {
  return <span aria-hidden className={`my-4 block border-t-[1.5px] border-dashed border-[#2b2420]/25`} />;
}

/** VANTA's seal in the artist's colour, pressed at the foot. */
function Seal({ className }: { className: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 -rotate-12 place-items-center rounded-full border-2 ${className}`} style={{ borderColor: "color-mix(in oklab, var(--accent) 75%, transparent)", color: "color-mix(in oklab, var(--accent) 85%, transparent)" }}>
      <span className="grid h-[78%] w-[78%] place-items-center rounded-full border border-current">
        <VantaMark className="h-[42%] w-auto" />
      </span>
    </span>
  );
}

function Ledger({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className={`shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[#2b2420]/60`}>{label}</dt>
      <span aria-hidden className={`min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[#2b2420]/35`} />
      <dd className="max-w-[62%] text-right">{children}</dd>
    </div>
  );
}
