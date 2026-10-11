import { fill, type Dict, type Locale } from "@/i18n";
import type { ChatCard } from "@/lib/chat";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { cmLabel, moneyRange } from "@/lib/format";
import {
  PAIN_COLORS,
  PAIN_LABELS,
  PLACEMENT_BY_SLUG,
  painFor,
} from "@/mannequin/catalog";

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
}: {
  card: ChatCard;
  t: Dict;
  locale: Locale;
  artist: string;
  open?: boolean;
}) {
  const c = t.chat.card;
  const placement = PLACEMENT_BY_SLUG.get(card.placement);
  const pain = painFor(card.placement);
  const size = card.full_coverage
    ? t.studio.brief.fullCoverage
    : cmLabel(card.size_w_cm, card.size_h_cm);
  const timing =
    card.timing === "specific" && card.preferred_dates
      ? card.preferred_dates
      : t.brief.timing[card.timing];
  return (
    <CardDialog
      label={c.pinned}
      className="group flex w-full items-center gap-3 rounded-[14px] border border-gilt/60 bg-niche px-3.5 py-2.5 text-left transition hover:border-gilt"
      trigger={
        <>
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line bg-soot"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: PAIN_COLORS[pain] }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.95rem] leading-tight">
              <span className="text-gilt">{c.pinned}</span> ·{" "}
              {styleLabel(card.style, locale)} ·{" "}
              {placement?.label[locale] ?? card.placement}
            </span>
            <span className="mt-0.5 block truncate text-[0.78rem] text-ash">
              {fill(c.sentTo, { artist })} · {card.ref}
            </span>
          </span>
          <span
            aria-hidden
            className="shrink-0 text-[1.1rem] text-gilt transition-transform group-hover:translate-x-0.5"
          >
            ›
          </span>
        </>
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
