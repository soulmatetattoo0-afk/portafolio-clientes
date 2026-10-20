import { fill, type Dict, type Locale } from "@/i18n";
import type { ChatCard } from "@/lib/chat";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { cmLabel, moneyRange, prettyDates } from "@/lib/format";
import {
  PAIN_COLORS,
  PAIN_LABELS,
  PLACEMENT_BY_SLUG,
  painFor,
} from "@/mannequin/catalog";

import { VantaMark } from "@/components/brand/VantaLogo";

import { PlacementPreview } from "@/app/studio/_legacy/PlacementPreview";

import { CardDialog } from "./CardDialog";

/**
 * The request as it was sent, pinned to the top of the conversation: a slim
 * horizontal card with its headline; a tap opens the whole letter (every
 * detail, the words, the reference images) over the chat.
 */
export function RequestCard({
  card,
  t,
  locale,
  artist,
  compact = false,
  figure = false,
}: {
  card: ChatCard;
  t: Dict;
  locale: Locale;
  artist: string;
  open?: boolean;
  /** One line on paper (inside a booking confirmation) instead of the whole letter. */
  compact?: boolean;
  /** Show the chosen area on the figure inside the letter (the artist's side). */
  figure?: boolean;
}) {
  const c = t.chat.card;
  const placement = PLACEMENT_BY_SLUG.get(card.placement);
  const pain = painFor(card.placement);
  const size = card.full_coverage
    ? t.studio.brief.fullCoverage
    : cmLabel(card.size_w_cm, card.size_h_cm);
  const timing =
    card.timing === "specific" && card.preferred_dates
      ? prettyDates(card.preferred_dates, locale)
      : t.brief.timing[card.timing];
  return (
    <CardDialog
      label={c.pinned}
      className={
        compact
          ? "group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-[12px] bg-[#efe7d6] px-3 py-2.5 text-left text-[#1c1815] transition-transform active:scale-[0.98]"
          : "group relative block w-full overflow-hidden rounded-[18px] bg-[#efe7d6] p-4 pb-5 text-left text-[#1c1815] shadow-[0_18px_36px_-18px_rgb(0_0_0/0.8)] transition-transform active:scale-[0.98]"
      }
      trigger={
        compact ? (
          <>
            <span aria-hidden className="grid h-9 w-9 shrink-0 -rotate-12 place-items-center rounded-full border-2 border-[#b0201a]/70 text-[#b0201a]/80">
              <VantaMark className="h-4 w-auto" />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block truncate text-[0.9rem] font-semibold">
                {styleLabel(card.style, locale)} · {placement?.label[locale] ?? card.placement}
              </span>
              <span className="block truncate text-[0.78rem] text-[#554c42]">
                {[card.ref, card.city, timing].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-[0.75rem] font-semibold group-hover:underline">{c.compact} ›</span>
          </>
        ) : (
        <>
          {/* The letter: VANTA's paper, the request in a few lines, the house seal closing it. */}
          <span className="flex items-baseline justify-between gap-3">
            <span className="p-display text-[1.7rem] leading-none tracking-[0.01em]">{c.letter}</span>
            <span className="text-[0.62rem] font-semibold tracking-[0.2em] text-[#554c42] uppercase">{card.ref}</span>
          </span>
          <span className="mt-2 block border-t border-[#1c1815]/15 pt-2 text-[0.92rem] leading-snug">
            {styleLabel(card.style, locale)} · {placement?.label[locale] ?? card.placement}
          </span>
          {/* Where and when: the city the client chose and the day they asked for. */}
          <span className="mt-1 block text-[0.82rem] text-[#554c42]">
            {[card.city, timing].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-1.5 line-clamp-3 block font-serif text-[1rem] leading-snug text-[#3a332d] italic">{card.description}</span>
          {/* The client's reference photos, pinned to the letter like prints. */}
          {card.files.length > 0 && (
            <span className="mt-3 flex gap-2">
              {card.files.slice(0, 3).map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.id} src={f.url} alt="" loading="lazy" className="h-[4.6rem] w-[3.7rem] rounded-[6px] object-cover shadow-[0_6px_14px_-6px_rgb(0_0_0/0.6)]" style={{ transform: `rotate(${[-2, 1, -1][i]}deg)` }} />
              ))}
              {card.files.length > 3 && <span className="self-end text-[0.75rem] text-[#554c42]">+{card.files.length - 3}</span>}
            </span>
          )}
          <span className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[0.75rem] text-[#554c42]">
              {fill(c.sentTo, { artist })}
              <span className="mt-0.5 block font-semibold text-[#1c1815] group-hover:underline">{c.tapToOpen} ›</span>
            </span>
            <span aria-hidden className="grid h-14 w-14 shrink-0 -rotate-12 place-items-center rounded-full border-2 border-[#b0201a]/70 text-[#b0201a]/80">
              <VantaMark className="h-6 w-auto" />
            </span>
          </span>
        </>
        )
      }
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-niche/95 px-5 pt-4 pb-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-gilt uppercase">
            {c.pinned} · {card.ref}
          </p>
          <p className="mt-1 font-serif text-[1.4rem] leading-tight">
            {styleLabel(card.style, locale)} ·{" "}
            {placement?.label[locale] ?? card.placement}
          </p>
          <p className="mt-0.5 text-[0.85rem] text-ash">
            {fill(c.sentTo, { artist })}
          </p>
        </div>
        <button
          type="button"
          data-close
          className="btn btn-ghost btn-sm shrink-0"
          aria-label={t.common.close}
        >
          ×
        </button>
      </div>
      <div className="grid gap-5 px-5 pt-4 pb-6 text-[0.95rem]">
        {figure && placement && (
          // The chosen area on the figure, framed close, as the client marked it.
          <div>
            <p className="mb-2 text-[0.75rem] text-ash">{c.onFigure}</p>
            <PlacementPreview
              body={card.body}
              heightCm={card.body === "f" ? 167 : 178}
              placement={card.placement}
              widthCm={card.size_w_cm}
              heightCmDesign={card.size_h_cm}
              label={placement.label[locale]}
              front={t.brief.placement.front}
              back={t.brief.placement.back}
            />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Row label={c.style}>
            {styleLabel(card.style, locale)},{" "}
            {colorLabel(card.color_mode, locale).toLowerCase()}
          </Row>
          <Row label={c.placement}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: PAIN_COLORS[pain] }}
              />
              {placement?.label[locale]}
            </span>
            <span className="block text-[0.8rem] text-ash">
              {c.pain}: {PAIN_LABELS[pain][locale]}
            </span>
          </Row>
          <Row label={c.size}>{size}</Row>
          <Row label={c.figure}>
            {card.body === "f"
              ? t.brief.placement.female
              : t.brief.placement.male}
          </Row>
          <Row label={c.when}>{timing}</Row>
          <Row label={c.city}>{card.city ?? "—"}</Row>
          <Row label={c.budget}>
            <span className="t-num">
              {moneyRange(
                card.budget_min_cents,
                card.budget_max_cents,
                card.currency,
                locale,
              ) || "—"}
            </span>
          </Row>
          {(card.is_coverup || card.is_first_tattoo) && (
            <Row label={c.notes}>
              {[
                card.is_coverup ? t.studio.brief.coverup : null,
                card.is_first_tattoo ? t.studio.brief.firstTattoo : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Row>
          )}
        </dl>
        <div>
          <p className="text-[0.75rem] text-ash">{c.idea}</p>
          <p className="mt-1 font-serif text-[1.15rem] leading-relaxed whitespace-pre-line">
            {card.description}
          </p>
          {card.avoid && (
            <p className="mt-3 border-l-2 border-oxblood/60 pl-3 whitespace-pre-line text-vellum/85">
              <span className="block text-[0.75rem] text-ash">{c.avoid}</span>
              {card.avoid}
            </p>
          )}
        </div>
        {card.files.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {card.files.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-[10px] border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardDialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.75rem] text-ash">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
