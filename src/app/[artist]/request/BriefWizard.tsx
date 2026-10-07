"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Halo } from "@/app/HeroFigure";
import { LangToggle } from "@/components/LangToggle";
import { Mannequin, type MannequinHandle } from "@/components/Mannequin";
import { fill, type Dict, type Locale } from "@/i18n";
import { BUDGETS, COLOR_MODES, STYLES, colorLabel, styleLabel } from "@/lib/catalog";
import { dateRange, money } from "@/lib/format";
import { BODY_HEIGHT_CM, GROUP_LABELS, MIN_DESIGN_CM, PLACEMENTS, PLACEMENT_BY_SLUG, maxSizeFor, sizeBand, type BodyType, type PlacementGroup } from "@/mannequin/catalog";
import type { DesignPlacement } from "@/mannequin/engine";

import { prepareUploads, submitBrief } from "./actions";

type Shape = "tall" | "square" | "wide";
type StepId = "style" | "placement" | "size" | "idea" | "timing" | "contact" | "review";
const STEPS: StepId[] = ["style", "placement", "size", "idea", "timing", "contact", "review"];

interface Draft {
  step: number;
  style: string | null;
  color: "black_grey" | "color" | "undecided" | null;
  body: BodyType;
  height: number;
  placement: string | null;
  size: number;
  shape: Shape;
  rotation: number;
  point: [number, number, number] | null;
  normal: [number, number, number] | null;
  description: string;
  avoid: string;
  coverup: boolean;
  firstTattoo: boolean;
  stopId: string | null;
  timing: "asap" | "flexible" | "specific" | null;
  dates: string;
  budget: number | null;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  adult: boolean;
  attribution: Record<string, string>;
}

const EMPTY: Draft = {
  step: 0,
  style: null,
  color: null,
  body: "f",
  height: BODY_HEIGHT_CM.f,
  placement: null,
  size: 10,
  shape: "tall",
  rotation: 0,
  point: null,
  normal: null,
  description: "",
  avoid: "",
  coverup: false,
  firstTattoo: false,
  stopId: null,
  timing: null,
  dates: "",
  budget: null,
  name: "",
  email: "",
  phone: "",
  instagram: "",
  adult: false,
  attribution: {},
};

interface Props {
  t: Dict;
  locale: Locale;
  artist: { slug: string; name: string; styles: string[]; minPriceCents: number | null; currency: string };
  stops: { id: string; city: string; studio: string | null; startsOn: string | null; endsOn: string | null; home: boolean }[];
  storage: { url: string; anonKey: string } | null;
}

interface PickedFile {
  id: string;
  file: File;
  preview: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_REFS = 8;
const MAX_BYTES = 10 * 1024 * 1024;

function dims(size: number, shape: Shape): [number, number] {
  if (shape === "square") return [size, size];
  const short = Math.max(MIN_DESIGN_CM, Math.round(size * 0.66));
  return shape === "tall" ? [short, size] : [size, short];
}

/** Shrink large photos in the browser before upload; keeps originals the browser can't decode. */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function BriefWizard({ t, locale, artist, stops, storage }: Props) {
  const b = t.brief;
  const router = useRouter();
  const draftKey = `brief-draft:${artist.slug}`;
  const [d, setD] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [refs, setRefs] = useState<PickedFile[]>([]);
  const [skin, setSkin] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Blob | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const viewer = useRef<MannequinHandle>(null);
  const panelTop = useRef<HTMLDivElement>(null);
  const uid = useId();

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value })), []);
  const step = STEPS[d.step];
  const placement = d.placement ? PLACEMENT_BY_SLUG.get(d.placement) : null;
  const [w, h] = dims(d.size, d.shape);

  // Restore a draft and capture where the client came from.
  useEffect(() => {
    let saved: Partial<Draft> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    } catch {}
    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref"]) {
      const v = params.get(k);
      if (v) attribution[k] = v.slice(0, 300);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
      try {
        attribution.referrer = new URL(document.referrer).host;
      } catch {}
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD((prev) => {
      const next = { ...prev, ...(saved ?? {}) };
      next.attribution = { ...(saved?.attribution ?? {}), ...attribution };
      return next;
    });
    if (saved && (saved.step ?? 0) > 0) setRestored(true);
  }, [draftKey]);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(d));
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [d, draftKey]);

  useEffect(
    () => () => {
      refs.forEach((r) => URL.revokeObjectURL(r.preview));
      if (skin) URL.revokeObjectURL(skin.preview);
    },
    // Revoke previews only when the wizard unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ------------------------------------------------------------ validation */

  const errors = useMemo(() => {
    const e: Partial<Record<string, string>> = {};
    if (!d.style) e.style = b.style.required;
    if (!d.color) e.color = b.style.colorRequired;
    if (!d.placement) e.placement = b.placement.required;
    if (d.description.trim().length < 10) e.description = b.idea.descriptionShort;
    if (!d.timing) e.timing = b.timing.whenRequired;
    if (d.budget === null) e.budget = b.timing.budgetRequired;
    if (d.name.trim().length < 2) e.name = b.contact.nameRequired;
    if (!EMAIL_RE.test(d.email.trim())) e.email = b.contact.emailInvalid;
    if (!d.adult) e.adult = b.contact.adultRequired;
    return e;
  }, [d, b]);

  const fieldsByStep: Record<StepId, string[]> = {
    style: ["style", "color"],
    placement: ["placement"],
    size: [],
    idea: ["description"],
    timing: ["timing", "budget"],
    contact: ["name", "email", "adult"],
    review: [],
  };
  const show = (field: string) => (tried[step] || touched[field] ? errors[field] : undefined);

  const budgets = useMemo(() => {
    const min = artist.minPriceCents ?? 0;
    return BUDGETS.filter(([, max]) => max === null || max > min);
  }, [artist.minPriceCents]);

  /* ------------------------------------------------------------ navigation */

  const scrollTop = () => {
    requestAnimationFrame(() => {
      const el = panelTop.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    });
  };

  const goTo = (i: number) => {
    set("step", Math.max(0, Math.min(STEPS.length - 1, i)));
    scrollTop();
  };

  const next = async () => {
    const missing = fieldsByStep[step].filter((f) => errors[f]);
    if (missing.length) {
      setTried((p) => ({ ...p, [step]: true }));
      requestAnimationFrame(() => document.getElementById(`${uid}-${missing[0]}`)?.focus());
      return;
    }
    // Capture the placement picture while the figure is on screen.
    if ((step === "size" || (step === "placement" && placement?.fullCoverage)) && viewer.current?.engine) {
      const blob = await viewer.current.engine.snapshotPlacement();
      setSnapshot(blob);
    }
    if (step === "placement" && placement?.fullCoverage) goTo(d.step + 2);
    else goTo(d.step + 1);
  };

  const back = () => {
    if (step === "idea" && placement?.fullCoverage) goTo(d.step - 2);
    else goTo(d.step - 1);
  };

  const startOver = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setD({ ...EMPTY, attribution: d.attribution });
    setRestored(false);
    setTried({});
    setTouched({});
    setSnapshot(null);
  };

  /* ------------------------------------------------------------ files */

  const addRefs = (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    const picked: PickedFile[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_BYTES) {
        setFileError(fill(b.idea.tooBig, { name: file.name }));
        continue;
      }
      picked.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    setRefs((prev) => {
      const all = [...prev, ...picked];
      if (all.length > MAX_REFS) {
        setFileError(b.idea.tooMany);
        all.slice(MAX_REFS).forEach((r) => URL.revokeObjectURL(r.preview));
      }
      return all.slice(0, MAX_REFS);
    });
  };

  const removeRef = (id: string) =>
    setRefs((prev) => {
      const gone = prev.find((r) => r.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((r) => r.id !== id);
    });

  /* ------------------------------------------------------------ submit */

  const send = async () => {
    const firstBad = STEPS.findIndex((s) => fieldsByStep[s].some((f) => errors[f]));
    if (firstBad >= 0) {
      setTried((p) => ({ ...p, [STEPS[firstBad]]: true }));
      goTo(firstBad);
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const outgoing: { kind: "reference" | "skin" | "placement"; blob: Blob }[] = [];
      for (const r of refs) outgoing.push({ kind: "reference", blob: await shrink(r.file) });
      if (d.coverup && skin) outgoing.push({ kind: "skin", blob: await shrink(skin.file) });
      if (snapshot) outgoing.push({ kind: "placement", blob: snapshot });

      let uploadToken: string | null = null;
      const uploads: { key: string; kind: "reference" | "skin" | "placement" }[] = [];
      if (outgoing.length) {
        const meta = outgoing.map((o) => ({ kind: o.kind, type: o.blob.type || "image/jpeg", size: o.blob.size }));
        const prepared = await prepareUploads(artist.slug, meta);
        if ("error" in prepared) throw new Error(prepared.error);
        uploadToken = prepared.token;
        const supabase = storage ? (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey) : null;
        await Promise.all(
          prepared.targets.map(async (target, i) => {
            const blob = outgoing[i].blob;
            if (supabase && target.token && target.bucket) {
              const { error } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, blob, { contentType: blob.type });
              if (error) throw new Error(b.errors.upload);
            } else if (target.url) {
              const res = await fetch(target.url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
              if (!res.ok) throw new Error(b.errors.upload);
            }
            uploads.push({ key: target.key, kind: target.kind });
          }),
        );
      }

      const [bmin, bmax] = budgets[d.budget!] ?? budgets[0];
      const result = await submitBrief({
        artistSlug: artist.slug,
        style: d.style!,
        color: d.color!,
        body: d.body,
        height: d.height,
        placement: d.placement!,
        widthCm: placement?.fullCoverage ? null : w,
        heightCm: placement?.fullCoverage ? null : h,
        rotationDeg: d.rotation,
        point: d.point,
        normal: d.normal,
        description: d.description,
        avoid: d.avoid,
        coverup: d.coverup,
        firstTattoo: d.firstTattoo,
        stopId: (d.stopId ?? stops[0]?.id ?? "any") === "any" ? null : (d.stopId ?? stops[0].id),
        timing: d.timing!,
        dates: d.dates,
        budgetMin: bmin,
        budgetMax: bmax,
        name: d.name,
        email: d.email,
        phone: d.phone,
        instagram: d.instagram,
        adult: true,
        attribution: d.attribution,
        uploadToken,
        uploads,
      });
      if (!result.ok) throw new Error(result.error);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      router.push(`/${artist.slug}/request/sent?ref=${encodeURIComponent(result.ref)}`);
    } catch (e) {
      setSendError(e instanceof Error && e.message ? e.message : b.errors.generic);
      setSending(false);
    }
  };

  /* ------------------------------------------------------------ render */

  const figureStep = step === "placement" || step === "size";
  const viewerMode = step === "placement" ? "zone" : step === "size" && !placement?.fullCoverage ? "place" : "view";
  const design = placement && !placement.fullCoverage ? { widthCm: w, heightCm: h, rotationDeg: d.rotation } : null;
  const savedPoint = useMemo(() => (d.point && d.normal ? { point: d.point, normal: d.normal } : null), [d.point, d.normal]);
  const designMemo = useMemo(() => design, [design?.widthCm, design?.heightCm, design?.rotationDeg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onZoneTap = useCallback(
    (slug: string) => {
      setD((prev) => (prev.placement === slug ? prev : { ...prev, placement: slug, point: null, normal: null, size: Math.min(prev.size, maxSizeFor(slug)) }));
      setTouched((p) => ({ ...p, placement: true }));
    },
    [],
  );
  const onPlace = useCallback((p: DesignPlacement) => {
    setD((prev) => ({ ...prev, point: p.point, normal: p.normal }));
  }, []);

  const stepNames = b.steps;
  const total = STEPS.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.6rem)] pb-2 sm:px-6">
        <Link href={`/${artist.slug}`} className="t-inscription truncate py-2 text-[0.8rem] tracking-[0.24em] text-gilt">
          {artist.name.toUpperCase()}
        </Link>
        <LangToggle locale={locale} label={t.common.language} title={t.common.languageLabel} />
      </header>

      <nav aria-label={fill(b.title, { artist: artist.name })} className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p className="t-meta flex justify-between">
          <span>{fill(b.stepOf, { n: d.step + 1, total })}</span>
          <span className="text-ash">{stepNames[step]}</span>
        </p>
        <ol className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s} className={`h-[3px] rounded-full ${i <= d.step ? "bg-gilt" : "bg-line"}`} />
          ))}
        </ol>
      </nav>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-0 px-4 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pt-8">
        {/* The figure: sticky on phones while placing, always beside the form on desktop. */}
        <div className={`${figureStep && !noWebgl ? "block" : "hidden"} sticky top-0 z-10 -mx-4 bg-soot px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:px-0 lg:pb-0`}>
          <div className="relative h-[46dvh] min-h-[300px] overflow-hidden rounded-[var(--radius-lg)] border border-line [background:radial-gradient(ellipse_48%_38%_at_50%_30%,color-mix(in_oklab,var(--color-gilt)_14%,transparent),transparent_72%),radial-gradient(ellipse_70%_28%_at_50%_100%,rgb(0_0_0/0.55),transparent_70%),var(--color-niche)] lg:sticky lg:top-6 lg:h-[min(80dvh,760px)]">
            <Halo />
            {!noWebgl && (
              <Mannequin
                ref={viewer}
                className="absolute inset-0"
                body={d.body}
                heightCm={d.height}
                mode={viewerMode}
                placement={d.placement}
                design={designMemo}
                savedPoint={savedPoint}
                onZoneTap={onZoneTap}
                onPlace={onPlace}
                onUnsupported={() => setNoWebgl(true)}
                label={placement ? placement.label[locale] : b.placement.title}
              />
            )}
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              <button type="button" className="btn btn-secondary btn-sm bg-soot/70 backdrop-blur" onClick={() => viewer.current?.engine?.rotateTo("front")}>
                {b.placement.front}
              </button>
              <button type="button" className="btn btn-secondary btn-sm bg-soot/70 backdrop-blur" onClick={() => viewer.current?.engine?.rotateTo("back")}>
                {b.placement.back}
              </button>
            </div>
            {placement && (
              <p className="pointer-events-none absolute top-3 right-3 left-3 text-right font-serif text-[1.15rem] italic lg:text-[1.35rem]" aria-hidden>
                {placement.label[locale]}
                {!placement.fullCoverage && d.step >= 2 ? <span className="t-num ml-2 font-sans text-[0.85rem] text-ash not-italic">{w} × {h} cm</span> : null}
              </p>
            )}
          </div>
        </div>

        <section ref={panelTop} className="min-w-0 scroll-mt-4 pt-4 pb-32 lg:pt-0" aria-labelledby={`${uid}-title`}>
          {restored && d.step > 0 && (
            <p className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line px-4 py-3 text-[0.9rem] text-ash" role="status">
              {b.draftRestored}
              <button type="button" className="link text-[0.9rem]" onClick={startOver}>
                {b.startOver}
              </button>
            </p>
          )}

          {step === "style" && (
            <div className="grid gap-8">
              <StepHead id={`${uid}-title`} title={b.style.title} lead={b.style.lead} />
              <fieldset className="grid gap-3">
                <legend className="t-label mb-3">{fill(b.style.artistStyles, { artist: artist.name })}</legend>
                <FieldError id={`${uid}-style-err`} message={show("style")} />
                <div id={`${uid}-style`} tabIndex={-1} role="radiogroup" aria-invalid={Boolean(show("style"))} aria-describedby={`${uid}-style-err`} className="grid gap-2 sm:grid-cols-2">
                  {[...artist.styles.map((s) => STYLES.find((x) => x.slug === s)).filter(Boolean), ...STYLES.filter((s) => !artist.styles.includes(s.slug))].map((s, i) => (
                    <button
                      key={s!.slug}
                      type="button"
                      role="radio"
                      aria-checked={d.style === s!.slug}
                      onClick={() => set("style", s!.slug)}
                      className={`chip h-auto flex-col items-start gap-0.5 py-3 text-left ${i === artist.styles.length && artist.styles.length ? "sm:col-start-1" : ""}`}
                    >
                      <span className="font-semibold">{s!.label[locale]}</span>
                      <span className="text-[0.82rem] text-ash">{s!.hint[locale]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-3">
                <legend className="t-label mb-3">{b.style.colorTitle}</legend>
                <div id={`${uid}-color`} tabIndex={-1} role="radiogroup" className="flex flex-wrap gap-2" aria-describedby={`${uid}-color-err`}>
                  {COLOR_MODES.map((c) => (
                    <button key={c.slug} type="button" role="radio" aria-checked={d.color === c.slug} className="chip" onClick={() => set("color", c.slug)}>
                      {c.label[locale]}
                    </button>
                  ))}
                </div>
                <FieldError id={`${uid}-color-err`} message={show("color")} />
              </fieldset>
            </div>
          )}

          {step === "placement" && (
            <div className="grid gap-7">
              <StepHead id={`${uid}-title`} title={b.placement.title} lead={noWebgl ? b.placement.noWebgl : b.placement.lead} />
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
                <span className="t-label" id={`${uid}-figure`}>
                  {b.placement.figure}
                </span>
                <div className="seg w-fit" role="group" aria-labelledby={`${uid}-figure`}>
                  {(["f", "m"] as BodyType[]).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      aria-pressed={d.body === bt}
                      onClick={() => setD((p) => ({ ...p, body: bt, height: p.height === BODY_HEIGHT_CM[p.body] ? BODY_HEIGHT_CM[bt] : p.height, point: null, normal: null }))}
                    >
                      {bt === "f" ? b.placement.female : b.placement.male}
                    </button>
                  ))}
                </div>
                <label htmlFor={`${uid}-height`} className="t-label">
                  {b.placement.height}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id={`${uid}-height`}
                    type="range"
                    min={145}
                    max={205}
                    value={d.height}
                    onChange={(e) => setD((p) => ({ ...p, height: Number(e.target.value), point: null, normal: null }))}
                    className="w-full"
                  />
                  <output htmlFor={`${uid}-height`} className="t-num w-16 shrink-0 text-right">
                    {d.height} cm
                  </output>
                </div>
              </div>
              <div>
                <p className="t-label">{b.placement.chosen}</p>
                <p className={`mt-1 ${placement ? "font-serif text-[1.65rem] leading-tight" : "text-ash"}`} aria-live="polite">
                  {placement ? placement.label[locale] : b.placement.none}
                </p>
                <FieldError id={`${uid}-placement-err`} message={show("placement")} />
              </div>
              <div id={`${uid}-placement`} tabIndex={-1} className="border-t border-line">
                {(Object.keys(GROUP_LABELS) as PlacementGroup[]).map((g) => (
                  <details key={g} className="group border-b border-line" open={placement?.group === g}>
                    <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 [&::-webkit-details-marker]:hidden">
                      <span>{GROUP_LABELS[g][locale]}</span>
                      <span aria-hidden className="text-gilt transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="flex flex-wrap gap-2 pb-4">
                      {PLACEMENTS.filter((p) => p.group === g).map((p) => (
                        <button key={p.slug} type="button" className="chip" aria-pressed={d.placement === p.slug} onClick={() => onZoneTap(p.slug)}>
                          {p.label[locale]}
                        </button>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {step === "size" && placement && (
            <div className="grid gap-7">
              {placement.fullCoverage ? (
                <>
                  <StepHead id={`${uid}-title`} title={b.size.fullTitle} lead={fill(b.size.fullBody, { artist: artist.name })} />
                </>
              ) : (
                <>
                  <StepHead id={`${uid}-title`} title={b.size.title} lead={b.size.lead} />
                  <div className="grid gap-2">
                    <label htmlFor={`${uid}-size`} className="t-label">
                      {b.size.label}
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        id={`${uid}-size`}
                        type="range"
                        min={MIN_DESIGN_CM}
                        max={maxSizeFor(placement.slug)}
                        value={Math.min(d.size, maxSizeFor(placement.slug))}
                        onChange={(e) => set("size", Number(e.target.value))}
                        className="w-full"
                      />
                      <output htmlFor={`${uid}-size`} className="t-num shrink-0 text-[1.6rem] font-medium whitespace-nowrap">
                        {w} × {h} cm
                      </output>
                    </div>
                    <p className="text-ash">{b.size.bands[sizeBand(d.size)]}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="t-label" id={`${uid}-shape`}>
                      {b.size.shape}
                    </span>
                    <div className="seg" role="group" aria-labelledby={`${uid}-shape`}>
                      {(["tall", "square", "wide"] as Shape[]).map((s) => (
                        <button key={s} type="button" aria-pressed={d.shape === s} onClick={() => set("shape", s)}>
                          {b.size[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor={`${uid}-rot`} className="t-label">
                      {b.size.rotation}
                    </label>
                    <div className="flex items-center gap-4">
                      <input id={`${uid}-rot`} type="range" min={-90} max={90} step={5} value={d.rotation} onChange={(e) => set("rotation", Number(e.target.value))} className="w-full" />
                      <output htmlFor={`${uid}-rot`} className="t-num w-12 shrink-0 text-right">
                        {d.rotation}°
                      </output>
                    </div>
                  </div>
                  <p className="text-[0.9rem] text-ash">{b.size.tapToMove}</p>
                </>
              )}
              <p className="text-[0.85rem] text-ash-dim">{fill(b.size.approx, { artist: artist.name })}</p>
            </div>
          )}

          {step === "idea" && (
            <div className="grid gap-7">
              <StepHead id={`${uid}-title`} title={b.idea.title} lead={b.idea.lead} />
              <Field id={`${uid}-description`} label={b.idea.description} hint={b.idea.descriptionHint} error={show("description")}>
                <textarea
                  id={`${uid}-description`}
                  className="input min-h-40"
                  value={d.description}
                  maxLength={4000}
                  onChange={(e) => set("description", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, description: d.description.length > 0 }))}
                  aria-invalid={Boolean(show("description"))}
                  aria-describedby={`${uid}-description-hint ${uid}-description-err`}
                />
              </Field>

              <div className="grid gap-2">
                <p className="t-label" id={`${uid}-refs-label`}>
                  {b.idea.references} <span className="text-ash-dim">({t.common.optional})</span>
                </p>
                <p className="text-[0.85rem] text-ash-dim" id={`${uid}-refs-hint`}>
                  {b.idea.referencesHint}
                </p>
                {refs.length > 0 && (
                  <ul className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {refs.map((r) => (
                      <li key={r.id} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-line bg-niche">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.preview} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeRef(r.id)}
                          className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-soot/85 text-vellum"
                          aria-label={fill(b.idea.remove, { name: r.file.name })}
                        >
                          <span aria-hidden>×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {refs.length < MAX_REFS && (
                  <label className="btn btn-secondary w-fit cursor-pointer">
                    {b.idea.addImages}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      multiple
                      className="sr-only"
                      aria-describedby={`${uid}-refs-hint`}
                      onChange={(e) => {
                        addRefs(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <FieldError message={fileError ?? undefined} />
              </div>

              <Field id={`${uid}-avoid`} label={b.idea.avoid} hint={b.idea.avoidHint} optional={t.common.optional}>
                <textarea id={`${uid}-avoid`} className="input min-h-24" value={d.avoid} maxLength={2000} onChange={(e) => set("avoid", e.target.value)} aria-describedby={`${uid}-avoid-hint`} />
              </Field>

              <div className="grid gap-3">
                <Check id={`${uid}-coverup`} checked={d.coverup} onChange={(v) => set("coverup", v)} label={b.idea.coverup} />
                {d.coverup && (
                  <div className="ml-8 grid gap-2">
                    <p className="t-label">{b.idea.skinPhoto}</p>
                    <p className="text-[0.85rem] text-ash-dim">{b.idea.skinPhotoHint}</p>
                    <div className="flex items-center gap-3">
                      {skin && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={skin.preview} alt="" className="h-16 w-16 rounded-[var(--radius-sm)] border border-line object-cover" />
                      )}
                      <label className="btn btn-secondary btn-sm cursor-pointer">
                        {b.idea.addImages}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > MAX_BYTES) return setFileError(fill(b.idea.tooBig, { name: f.name }));
                            if (skin) URL.revokeObjectURL(skin.preview);
                            setSkin({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
                <Check id={`${uid}-first`} checked={d.firstTattoo} onChange={(v) => set("firstTattoo", v)} label={b.idea.firstTattoo} />
              </div>
            </div>
          )}

          {step === "timing" && (
            <div className="grid gap-8">
              <StepHead id={`${uid}-title`} title={b.timing.title} lead={fill(b.timing.lead, { artist: artist.name })} />
              {stops.length > 0 && (
                <fieldset className="grid gap-2">
                  <legend className="t-label mb-2">{b.timing.city}</legend>
                  {[...stops, null].map((s) => {
                    const value = s ? s.id : "any";
                    const selected = (d.stopId ?? stops[0]?.id) === value;
                    return (
                      <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 ${selected ? "border-gilt" : "border-line-strong"}`}>
                        <input type="radio" name={`${uid}-stop`} checked={selected} onChange={() => set("stopId", value)} />
                        <span className="min-w-0">
                          <span className="block">{s ? s.city : b.timing.anyCity}</span>
                          {s && <span className="block text-[0.85rem] text-ash">{[s.studio, s.home ? null : dateRange(s.startsOn, s.endsOn, locale)].filter(Boolean).join(", ")}</span>}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
              <fieldset className="grid gap-2">
                <legend className="t-label mb-2">{b.timing.when}</legend>
                <div id={`${uid}-timing`} tabIndex={-1} role="radiogroup" className="flex flex-wrap gap-2">
                  {(["asap", "flexible", "specific"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={d.timing === v} className="chip" onClick={() => set("timing", v)}>
                      {b.timing[v]}
                    </button>
                  ))}
                </div>
                <FieldError message={show("timing")} />
                {d.timing === "specific" && (
                  <Field id={`${uid}-dates`} label={b.timing.dates} hint={b.timing.datesHint}>
                    <input id={`${uid}-dates`} className="input" value={d.dates} maxLength={500} onChange={(e) => set("dates", e.target.value)} aria-describedby={`${uid}-dates-hint`} />
                  </Field>
                )}
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="t-label mb-2">{b.timing.budget}</legend>
                {artist.minPriceCents ? (
                  <p className="text-[0.88rem] text-ash-dim">{fill(b.timing.budgetHint, { artist: artist.name, price: money(artist.minPriceCents, artist.currency, locale) })}</p>
                ) : null}
                <div id={`${uid}-budget`} tabIndex={-1} role="radiogroup" className="mt-1 grid gap-2 sm:grid-cols-2">
                  {budgets.map(([min, max], i) => (
                    <button key={i} type="button" role="radio" aria-checked={d.budget === i} className="chip t-num justify-start" onClick={() => set("budget", i)}>
                      {max ? `${money(min, artist.currency, locale)}–${money(max, artist.currency, locale)}` : fill(b.timing.budgetOpen, { price: money(min, artist.currency, locale) })}
                    </button>
                  ))}
                </div>
                <FieldError message={show("budget")} />
              </fieldset>
            </div>
          )}

          {step === "contact" && (
            <div className="grid gap-6">
              <StepHead id={`${uid}-title`} title={fill(b.contact.title, { artist: artist.name })} lead={b.contact.lead} />
              <Field id={`${uid}-name`} label={b.contact.name} error={show("name")}>
                <input
                  id={`${uid}-name`}
                  className="input"
                  autoComplete="name"
                  value={d.name}
                  maxLength={120}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, name: d.name.length > 0 }))}
                  aria-invalid={Boolean(show("name"))}
                  aria-describedby={`${uid}-name-err`}
                />
              </Field>
              <Field id={`${uid}-email`} label={b.contact.email} error={show("email")}>
                <input
                  id={`${uid}-email`}
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={d.email}
                  maxLength={200}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, email: d.email.length > 0 }))}
                  aria-invalid={Boolean(show("email"))}
                  aria-describedby={`${uid}-email-err`}
                />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id={`${uid}-phone`} label={b.contact.phone} optional={t.common.optional}>
                  <input id={`${uid}-phone`} className="input" type="tel" autoComplete="tel" value={d.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field id={`${uid}-instagram`} label={b.contact.instagram} optional={t.common.optional} hint={fill(b.contact.instagramHint, { artist: artist.name })}>
                  <input id={`${uid}-instagram`} className="input" autoComplete="off" placeholder="@" value={d.instagram} maxLength={60} onChange={(e) => set("instagram", e.target.value)} aria-describedby={`${uid}-instagram-hint`} />
                </Field>
              </div>
              <div>
                <Check id={`${uid}-adult`} checked={d.adult} onChange={(v) => set("adult", v)} label={b.contact.adult} invalid={Boolean(show("adult"))} />
                <FieldError message={show("adult")} />
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="grid gap-7">
              <StepHead id={`${uid}-title`} title={b.review.title} lead={fill(b.review.lead, { artist: artist.name })} />
              <dl className="divide-y divide-line border-y border-line">
                <ReviewRow label={stepNames.style} edit={() => goTo(0)} editLabel={t.common.edit}>
                  {styleLabel(d.style, locale)}, {colorLabel(d.color, locale).toLowerCase()}
                </ReviewRow>
                <ReviewRow label={stepNames.placement} edit={() => goTo(1)} editLabel={t.common.edit}>
                  {placement?.label[locale]}
                  {placement && !placement.fullCoverage ? <span className="t-num text-ash">, {w} × {h} cm</span> : null}
                </ReviewRow>
                <ReviewRow label={stepNames.idea} edit={() => goTo(3)} editLabel={t.common.edit}>
                  <span className="block whitespace-pre-line">{d.description}</span>
                  {d.avoid && <span className="mt-2 block text-ash">{b.review.notes}: {d.avoid}</span>}
                  <span className="mt-2 block text-[0.88rem] text-ash">
                    {[refs.length === 1 ? b.review.referencesOne : refs.length ? fill(b.review.references, { n: refs.length }) : b.review.noReferences, d.coverup ? b.review.coverup : null, d.firstTattoo ? b.review.firstTattoo : null]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </ReviewRow>
                <ReviewRow label={stepNames.timing} edit={() => goTo(4)} editLabel={t.common.edit}>
                  {[
                    stops.find((s) => s.id === (d.stopId ?? stops[0]?.id))?.city ?? (stops.length ? b.timing.anyCity : null),
                    d.timing ? (d.timing === "specific" && d.dates ? d.dates : b.timing[d.timing]) : null,
                    d.budget !== null && budgets[d.budget]
                      ? budgets[d.budget][1]
                        ? `${money(budgets[d.budget][0], artist.currency, locale)}–${money(budgets[d.budget][1], artist.currency, locale)}`
                        : fill(b.timing.budgetOpen, { price: money(budgets[d.budget][0], artist.currency, locale) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </ReviewRow>
                <ReviewRow label={stepNames.contact} edit={() => goTo(5)} editLabel={t.common.edit}>
                  {d.name}
                  <span className="block text-ash">{d.email}</span>
                </ReviewRow>
              </dl>
              <FieldError message={sendError ?? undefined} />
            </div>
          )}
        </section>
      </div>

      {/* One primary action, always reachable with a thumb. */}
      <div className="sticky bottom-0 z-20 border-t border-line bg-soot/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6">
          {d.step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={back} disabled={sending}>
              {t.common.back}
            </button>
          ) : (
            <Link href={`/${artist.slug}`} className="btn btn-ghost">
              {t.common.cancel}
            </Link>
          )}
          {step === "review" ? (
            <button type="button" className="btn btn-primary min-w-48" onClick={send} disabled={sending} aria-busy={sending}>
              {sending ? b.review.sending : fill(b.review.send, { artist: artist.name })}
            </button>
          ) : (
            <button type="button" className="btn btn-primary min-w-40" onClick={next}>
              {t.common.continue}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHead({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div>
      <h1 id={id} className="t-title">
        {title}
      </h1>
      <p className="mt-2 max-w-[52ch] text-ash">{lead}</p>
    </div>
  );
}

function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="t-label">
        {label} {optional && <span className="text-ash-dim">({optional})</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[0.85rem] text-ash-dim">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <p id={id} role="alert" className={`text-[0.88rem] text-oxblood ${message ? "" : "hidden"}`}>
      {message}
    </p>
  );
}

function Check({ id, checked, onChange, label, invalid }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; invalid?: boolean }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid} />
      <span>{label}</span>
    </label>
  );
}

function ReviewRow({ label, children, edit, editLabel }: { label: string; children: React.ReactNode; edit: () => void; editLabel: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4">
      <dt className="t-label">{label}</dt>
      <dd className="col-start-1 min-w-0">{children}</dd>
      <dd className="col-start-2 row-span-2 row-start-1 self-start">
        <button type="button" className="btn btn-ghost btn-sm" onClick={edit} aria-label={`${editLabel}: ${label}`}>
          {editLabel}
        </button>
      </dd>
    </div>
  );
}
