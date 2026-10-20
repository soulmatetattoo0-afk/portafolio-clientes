"use client";

import { useActionState, useState } from "react";

import { useSubmit } from "@/components/useSubmit";
import type { Dict, Locale } from "@/i18n";
import { STYLES, timezoneFor } from "@/lib/catalog";
import { placeTiles, type Tile } from "@/lib/layout";

import { createStudio, type OnboardingState } from "./actions";

type Code = "cl" | "us" | "mx";

const toSlug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const ACCENTS = ["#c8231e", "#d8552f", "#e0a32e", "#2f7d5b", "#1f6f8b", "#6a4fb3", "#c2185b", "#efe7d6"];

/** Three ways to open the screen; the artist fine-tunes later in Tu pantalla. */
export const PRESETS: Tile[][] = [
  [
    { kind: "mag", w: 2, h: 3 },
    { kind: "book", w: 1, h: 2 },
    { kind: "cal", w: 1, h: 1 },
    { kind: "work", w: 1, h: 1 },
  ],
  [
    { kind: "mag", w: 1, h: 3 },
    { kind: "book", w: 1, h: 1 },
    { kind: "cal", w: 1, h: 1 },
    { kind: "work", w: 1, h: 1 },
  ],
  [
    { kind: "book", w: 2, h: 1 },
    { kind: "mag", w: 2, h: 2 },
    { kind: "cal", w: 1, h: 1 },
    { kind: "work", w: 1, h: 1 },
  ],
];

/** A tiny phone with the tiles of a layout, coloured like the real thing. */
function MiniScreen({ tiles, accent, names }: { tiles: Tile[]; accent: string; names: Record<string, string> }) {
  const { rows, spots } = placeTiles(tiles);
  return (
    <div className="grid h-full w-full gap-1 overflow-hidden rounded-[12px] bg-ink p-1" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {tiles.map((t, i) => (
        <div
          key={t.kind}
          className="flex min-w-0 items-end overflow-hidden rounded-[6px] p-1 text-[0.45rem] font-semibold uppercase leading-none"
          style={{
            gridColumn: `${spots[i].col} / span ${t.w}`,
            gridRow: `${spots[i].row} / span ${t.h}`,
            background: t.kind === "book" ? accent : t.kind === "cal" ? "#e9e2d4" : "#2a2622",
            color: t.kind === "cal" ? "#1c1815" : "#efe7d6",
          }}
        >
          {names[t.kind]}
        </div>
      ))}
    </div>
  );
}

/**
 * Making a VANTA, one question at a time, with the page taking shape beside
 * each answer: the name set huge in the chosen colour, the city, the styles,
 * and the screen clients will see first.
 */
export function OnboardingForm({ t, locale, timezones, countries }: { t: Dict; locale: Locale; timezones: string[]; countries: { code: Code; label: string; cities: string[] }[] }) {
  const o = t.studio.onboarding;
  const kinds = t.studio.screenEditor.kinds;
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createStudio, { error: null });
  const onSubmit = useSubmit(action);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState<Code>(countries[0].code);
  const cities = countries.find((c) => c.code === country)!.cities;
  const [city, setCity] = useState(cities[0]);
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [styles, setStyles] = useState<string[]>([]);
  const [preset, setPreset] = useState(0);
  const tz = timezoneFor(country, city);
  const last = o.steps.length - 1;
  const canNext = step !== 0 || name.trim().length >= 2;
  const toggle = (s: string) => setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < 5 ? [...cur, s] : cur));

  return (
    <form onSubmit={onSubmit} className="poster grid min-h-[calc(100svh-6rem)] content-start gap-6 rounded-[28px] p-5 sm:p-8" style={{ ["--accent" as string]: accent }}>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="timezone" value={timezones.includes(tz) ? tz : timezones[0]} />
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="styles" value={styles.join(",")} />
      <input type="hidden" name="layout" value={JSON.stringify(PRESETS[preset])} />

      {/* Progress: one bar per question */}
      <div className="flex gap-1.5" aria-hidden>
        {o.steps.map((s, i) => (
          <span key={s} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= step ? "var(--accent)" : "rgb(233 226 212 / 0.18)" }} />
        ))}
      </div>
      <p className="p-stamp text-bone/60">
        {step + 1} / {o.steps.length} · {o.steps[step]}
      </p>

      {/* The poster that grows with every answer */}
      <div className="relative overflow-hidden rounded-[22px] bg-ink-2 p-5" style={{ boxShadow: "0 24px 48px -24px rgb(0 0 0 / 0.8)" }}>
        <div className="p-halftone" />
        <p className="p-stamp relative text-bone/60">VANTA · {o.link}: /{slug || "…"}</p>
        <p className="p-display relative mt-2 break-words text-[clamp(2.8rem,13vw,5rem)] leading-[0.86] transition-colors duration-300" style={{ color: "var(--accent)" }}>
          {name || o.name}
        </p>
        <p className="p-stamp relative mt-3 text-bone/70">
          {[city, styles.map((s) => STYLES.find((x) => x.slug === s)?.label[locale]).filter(Boolean).join(" · ")].filter(Boolean).join(" — ")}
        </p>
      </div>

      <div key={step} className="animate-rise grid gap-4">
        {step === 0 && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.nameAsk}</h2>
            <p className="text-bone/75">{o.nameHint}</p>
            <input
              autoFocus
              required
              maxLength={80}
              className="input text-[1.3rem]"
              value={name}
              aria-label={o.name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(toSlug(e.target.value));
              }}
              aria-invalid={state.field === "name"}
            />
            <label className="grid gap-1.5">
              <span className="p-stamp text-bone/60">{o.slug}</span>
              <div className="flex items-center rounded-[var(--radius-sm)] border border-bone/20">
                <span className="pl-3 text-bone/50">/</span>
                <input maxLength={40} className="input border-0 pl-1 focus:shadow-none" value={slug} onChange={(e) => setSlug(toSlug(e.target.value))} aria-invalid={state.field === "slug"} />
              </div>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.whereAsk}</h2>
            <p className="text-bone/75">{o.whereHint}</p>
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={country === c.code}
                  onClick={() => {
                    setCountry(c.code);
                    setCity(c.cities[0]);
                  }}
                  className={`rounded-full border px-4 py-2 ${country === c.code ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]" : "border-bone/20"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <button key={c} type="button" aria-pressed={city === c} onClick={() => setCity(c)} className={`rounded-full border px-4 py-2 text-[0.95rem] ${city === c ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]" : "border-bone/20 text-bone/80"}`}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.colorAsk}</h2>
            <p className="text-bone/75">{o.colorHint}</p>
            <div className="grid grid-cols-4 gap-3">
              {ACCENTS.map((c) => (
                <button key={c} type="button" aria-pressed={accent === c} aria-label={c} onClick={() => setAccent(c)} className="aspect-square rounded-full transition-transform" style={{ background: c, outline: accent === c ? "3px solid #efe7d6" : "none", outlineOffset: 3, transform: accent === c ? "scale(1.06)" : "none" }} />
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.stylesAsk}</h2>
            <p className="text-bone/75">{o.stylesHint}</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s.slug} type="button" aria-pressed={styles.includes(s.slug)} onClick={() => toggle(s.slug)} className={`rounded-full border px-4 py-2 text-[0.95rem] ${styles.includes(s.slug) ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]" : "border-bone/20 text-bone/80"}`}>
                  {s.label[locale]}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.screenAsk}</h2>
            <p className="text-bone/75">{o.screenHint}</p>
            <div className="grid grid-cols-3 gap-3">
              {PRESETS.map((tiles, i) => (
                <button key={i} type="button" aria-pressed={preset === i} onClick={() => setPreset(i)} className={`grid min-w-0 gap-2 rounded-[18px] border p-1.5 text-left ${preset === i ? "border-[var(--accent)]" : "border-bone/15"}`}>
                  <div className="aspect-[9/16]">
                    <MiniScreen tiles={tiles} accent={accent} names={kinds} />
                  </div>
                  <span className="text-[0.78rem] leading-tight text-bone/80">{o.layouts[i]}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === last && (
          <>
            <h2 className="p-display text-[clamp(2rem,9vw,3rem)] leading-[0.9]">{o.readyAsk}</h2>
            <p className="text-bone/75">{o.readyHint}</p>
          </>
        )}
      </div>

      <p role="alert" className={`text-[0.9rem] text-ember ${state.error ? "" : "hidden"}`}>
        {state.error}
      </p>

      <div className="mt-auto flex items-center gap-3">
        {step > 0 && (
          <button type="button" className="btn btn-ghost text-bone" onClick={() => setStep(step - 1)}>
            {o.back}
          </button>
        )}
        {step < last ? (
          <button type="button" className="btn ml-auto rounded-full px-6 text-bone" style={{ background: "var(--accent)" }} disabled={!canNext} onClick={() => setStep(step + 1)}>
            {o.next}
          </button>
        ) : (
          <button type="submit" disabled={pending} className="p-key ml-auto h-[72px] w-full max-w-[320px]">
            <span className="p-key-side" aria-hidden />
            <span className="p-key-cap">
              <span className="p-key-word p-display text-[1.6rem]">{o.createKey}</span>
            </span>
          </button>
        )}
      </div>
    </form>
  );
}
