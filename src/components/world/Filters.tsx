"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface FilterState {
  trade: string;
  styles: string[];
  city?: string;
  color?: "black_grey" | "color";
  healed: boolean;
  available?: "now" | "guest";
  priceMax?: number;
}

export interface FilterOptions {
  trades: { slug: string; label: string; live: boolean }[];
  styles: { slug: string; label: string }[];
  cities: { slug: string; city: string }[];
  /** Price ceilings in cents. */
  prices: { cents: number; label: string }[];
}

export interface FilterLabels {
  label: string;
  trade: string;
  styles: string;
  city: string;
  colour: string;
  blackGrey: string;
  color: string;
  healed: string;
  available: string;
  now: string;
  guest: string;
  price: string;
  anyPrice: string;
  clear: string;
  more: string;
  less: string;
  any: string;
}

/**
 * Every filter edits the URL, so a search is a link you can send. Trades
 * are links (a different world each); the rest toggle in place. The
 * second row of filters folds away until one of them is set.
 */
export function Filters({
  state,
  options,
  labels,
}: {
  state: FilterState;
  options: FilterOptions;
  labels: FilterLabels;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const secondary = Boolean(
    state.color || state.healed || state.available || state.priceMax,
  );
  const [open, setOpen] = useState(secondary);
  const live =
    options.trades.find((tr) => tr.slug === state.trade)?.live ?? true;

  const go = (edit: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    edit(p);
    p.delete("page");
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };
  const set = (k: string, v: string | null) =>
    go((p) => (v ? p.set(k, v) : p.delete(k)));
  const toggleStyle = (slug: string) => {
    const next = state.styles.includes(slug)
      ? state.styles.filter((s) => s !== slug)
      : [...state.styles, slug];
    set("styles", next.length ? next.join(",") : null);
  };
  const active =
    state.styles.length +
    (state.city ? 1 : 0) +
    (state.color ? 1 : 0) +
    (state.healed ? 1 : 0) +
    (state.available ? 1 : 0) +
    (state.priceMax ? 1 : 0);
  const tradeHref = (slug: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("trade", slug);
    p.delete("page");
    return `${path}?${p.toString()}`;
  };

  return (
    <div className="grid gap-2" aria-label={labels.label}>
      <Row label={labels.trade}>
        {options.trades.map((tr) => (
          <Link
            key={tr.slug}
            href={tradeHref(tr.slug)}
            className={`chip shrink-0 ${tr.live || state.trade === tr.slug ? "" : "text-bone-dim"}`}
            data-active={state.trade === tr.slug}
            aria-current={state.trade === tr.slug ? "true" : undefined}
          >
            {tr.label}
          </Link>
        ))}
      </Row>
      {live && (
        <Row label={labels.styles}>
          {options.styles.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="chip shrink-0"
              aria-pressed={state.styles.includes(s.slug)}
              onClick={() => toggleStyle(s.slug)}
            >
              {s.label}
            </button>
          ))}
        </Row>
      )}
      <Row label={labels.city}>
        {options.cities.map((c) => (
          <button
            key={c.slug}
            type="button"
            className="chip shrink-0"
            aria-pressed={state.city === c.slug}
            onClick={() => set("city", state.city === c.slug ? null : c.slug)}
          >
            {c.city}
          </button>
        ))}
      </Row>

      {open && (
        <div className="grid gap-2">
          <Row label={labels.colour}>
            <div
              className="seg shrink-0"
              role="group"
              aria-label={labels.colour}
            >
              <button
                type="button"
                aria-pressed={!state.color}
                onClick={() => set("color", null)}
              >
                {labels.any}
              </button>
              <button
                type="button"
                aria-pressed={state.color === "black_grey"}
                onClick={() => set("color", "black_grey")}
              >
                {labels.blackGrey}
              </button>
              <button
                type="button"
                aria-pressed={state.color === "color"}
                onClick={() => set("color", "color")}
              >
                {labels.color}
              </button>
            </div>
            <button
              type="button"
              className="chip shrink-0"
              aria-pressed={state.healed}
              onClick={() => set("healed", state.healed ? null : "1")}
            >
              {labels.healed}
            </button>
          </Row>
          <Row label={labels.available}>
            <div
              className="seg shrink-0"
              role="group"
              aria-label={labels.available}
            >
              <button
                type="button"
                aria-pressed={!state.available}
                onClick={() => set("available", null)}
              >
                {labels.any}
              </button>
              <button
                type="button"
                aria-pressed={state.available === "now"}
                onClick={() => set("available", "now")}
              >
                {labels.now}
              </button>
              <button
                type="button"
                aria-pressed={state.available === "guest"}
                onClick={() => set("available", "guest")}
              >
                {labels.guest}
              </button>
            </div>
            <label className="flex shrink-0 items-center gap-2">
              <span className="p-stamp text-bone-dim">{labels.price}</span>
              <select
                className="input min-h-[38px] py-0 text-[0.9rem]"
                value={state.priceMax ?? ""}
                onChange={(e) => set("priceMax", e.target.value || null)}
              >
                <option value="">{labels.anyPrice}</option>
                {options.prices.map((p) => (
                  <option key={p.cents} value={p.cents}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </Row>
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm text-bone-dim"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? labels.less : labels.more}
        </button>
        {active > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-bone-dim"
            onClick={() =>
              go((p) => {
                [
                  "styles",
                  "city",
                  "color",
                  "healed",
                  "available",
                  "priceMax",
                ].forEach((k) => p.delete(k));
              })
            }
          >
            {labels.clear} ({active})
          </button>
        )}
      </div>
    </div>
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
    <div
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]"
      role="group"
      aria-label={label}
    >
      <span className="p-stamp w-[4.2rem] shrink-0 text-[0.56rem] text-bone-dim">
        {label}
      </span>
      {children}
    </div>
  );
}
