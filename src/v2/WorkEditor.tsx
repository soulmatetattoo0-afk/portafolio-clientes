"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { addPiecesToSection, addSection, deletePortfolioItem, deleteSection, preparePortfolioUploads, quickPiece, replacePiece, setFraming } from "@/app/studio/_legacy/actions";
import { uploadFiles, type Storage } from "@/components/edit/upload";
import { fill, type Dict, type Locale } from "@/i18n";
import { STYLES, styleLabel } from "@/lib/catalog";
import type { PortfolioItem, PortfolioSection } from "@/lib/queries";

import { Framed, groupPieces } from "./Work";

/**
 * Editing the work: which style, then its photos, then one photo. A photo
 * shows large in its 4:5 window with three things to do under it: replace
 * it, frame it (drag to move, slide to zoom) or delete it.
 */
export function WorkEditor({ pieces, sections, storage, t, locale, back }: { pieces: PortfolioItem[]; sections: PortfolioSection[]; storage: Storage; t: Dict; locale: Locale; back: string }) {
  const w = t.v2.work;
  const router = useRouter();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [pieceId, setPieceId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupPieces(pieces, sections, locale, w.more), [pieces, sections, locale, w.more]);
  // Every section, even an empty one, so a new style can be filled.
  const list = [...sections.map((s) => ({ id: s.id, name: s.name, items: pieces.filter((p) => p.section_id === s.id) })), ...groups.filter((g) => !sections.some((s) => s.id === g.id)).map((g) => ({ id: g.id, name: g.name, items: g.items }))];
  const section = list.find((s) => s.id === sectionId) ?? null;
  const piece = pieces.find((p) => p.id === pieceId) ?? null;
  const run = (fn: () => Promise<{ error?: string } | void | unknown>, then?: () => void) =>
    start(async () => {
      setError(null);
      try {
        const r = (await fn()) as { error?: string } | void;
        if (r && typeof r === "object" && r.error) setError(r.error);
        else {
          then?.();
          router.refresh();
        }
      } catch {
        setError(t.v2.edit.error);
      }
    });
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const real = sections.some((s) => s.id === sectionId) ? sectionId : null;
    run(async () => {
      const up = await uploadFiles(preparePortfolioUploads, Array.from(files), storage);
      if (up) await addPiecesToSection(real, up.token, up.keys);
    });
  };

  const title = piece ? w.piece : section ? section.name : w.title;
  return (
    <div className="poster v2-page min-h-dvh">
      <header className="v2-top">
        <button type="button" onClick={() => (piece ? setPieceId(null) : section ? setSectionId(null) : router.push(back))} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </button>
        <h1 className="p-display flex-1 truncate text-[1.6rem] uppercase leading-none">{title}</h1>
        {!piece && !section && (
          <Link href={back} className="rounded-full border border-bone/25 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-bone">
            {t.v2.edit.done}
          </Link>
        )}
      </header>

      {piece ? (
        <PieceEditor piece={piece} sections={sections} storage={storage} t={t} pending={pending} error={error} run={run} onDeleted={() => setPieceId(null)} />
      ) : section ? (
        <div className="px-3 pt-3">
          <label className={`v2-btn w-full cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`} data-tone="accent">
            + {w.addPhotos}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={pending} onChange={(e) => upload(e.target.files)} />
          </label>
          {section.items.length === 0 ? (
            <p className="pt-5 text-center text-bone-dim">{w.noPieces}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 pt-3">
              {section.items.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPieceId(p.id)} className={`block w-full overflow-hidden rounded-[18px] bg-ink-2 ${p.published ? "" : "opacity-50"}`}>
                    <Framed item={p} className="aspect-[4/5] w-full" sizes="50vw" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sections.some((s) => s.id === section.id) && (
            <button type="button" className="mt-6 text-[0.85rem] text-bone-dim underline underline-offset-4" disabled={pending} onClick={() => confirm(w.deleteStyleConfirm) && run(() => deleteSection(section.id), () => setSectionId(null))}>
              {w.deleteStyle}
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 pt-3">
          <p className="px-1 pb-3 text-[1.05rem] text-bone/85">{w.which}</p>
          <ul className="grid gap-2">
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setSectionId(s.id)} className="v2-sheet flex w-full items-center gap-3 p-2.5 text-left">
                  {s.items[0]?.url ? <Framed item={s.items[0]} className="h-16 w-14 shrink-0 rounded-[12px]" /> : <span className="h-16 w-14 shrink-0 rounded-[12px] bg-ink" />}
                  <span className="min-w-0 flex-1">
                    <span className="p-display block truncate text-[1.5rem] uppercase leading-none">{s.name}</span>
                    <span className="text-[0.78rem] text-bone-dim">{fill(w.pieces, { n: s.items.length })}</span>
                  </span>
                  <span aria-hidden className="pr-2 text-bone-dim">›</span>
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form
              className="v2-sheet mt-3 grid gap-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const style = String(f.get("style") ?? "");
                const name = String(f.get("name") ?? "").trim() || (style ? styleLabel(style, locale) : "");
                if (!name) return;
                run(() => addSection(name, style || null), () => setAdding(false));
              }}
            >
              <label className="v2-field">
                <span>{w.pickStyle}</span>
                <select name="style" className="v2-input" defaultValue="">
                  <option value="">—</option>
                  {STYLES.filter((x) => x.slug !== "other").map((x) => (
                    <option key={x.slug} value={x.slug}>
                      {x.label[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="v2-field">
                <span>{w.styleName}</span>
                <input name="name" maxLength={60} className="v2-input" />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="v2-btn flex-1" data-tone="accent" disabled={pending}>
                  {w.addStyle}
                </button>
                <button type="button" className="v2-btn" data-tone="ghost" onClick={() => setAdding(false)}>
                  {t.common.cancel}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="v2-btn mt-3 w-full" data-tone="ghost">
              + {w.addStyle}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="px-4 pt-3 text-[0.88rem] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

function PieceEditor({ piece, sections, storage, t, pending, error, run, onDeleted }: { piece: PortfolioItem; sections: PortfolioSection[]; storage: Storage; t: Dict; pending: boolean; error: string | null; run: (fn: () => Promise<{ error?: string } | void | unknown>, then?: () => void) => void; onDeleted: () => void }) {
  const w = t.v2.work;
  const [framing, setFraming_] = useState(false);
  const [f, setF] = useState({ fx: piece.focus_x, fy: piece.focus_y, zoom: piece.zoom });
  const [confirming, setConfirming] = useState(false);
  const [words, setWords] = useState({ title: piece.title ?? "", story: piece.story ?? "", section_id: piece.section_id ?? "", published: piece.published });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const onDown = (e: React.PointerEvent) => {
    if (!framing) return;
    drag.current = { x: e.clientX, y: e.clientY, fx: f.fx, fy: f.fy };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    // Dragging the picture moves what sits under the window: the focus goes the other way, less the closer it is.
    setF((p) => ({ ...p, fx: clamp(d.fx - ((e.clientX - d.x) / el.clientWidth) * 100 / p.zoom), fy: clamp(d.fy - ((e.clientY - d.y) / el.clientHeight) * 100 / p.zoom) }));
  };
  const onUp = () => (drag.current = null);
  const shown = { ...piece, focus_x: f.fx, focus_y: f.fy, zoom: f.zoom };
  return (
    <div className="px-3 pt-3">
      <div ref={box} className={`mx-auto w-full max-w-[420px] overflow-hidden rounded-[18px] bg-ink-2 ${framing ? "cursor-move touch-none ring-2 ring-accent" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Framed item={shown} className="aspect-[4/5] w-full select-none" sizes="100vw" />
      </div>
      {framing ? (
        <div className="v2-sheet mt-3 grid gap-3 p-4">
          <p className="text-[0.88rem] text-bone-dim">{w.framingHint}</p>
          <label className="v2-field">
            <span>
              {w.zoom} · {f.zoom.toFixed(1)}×
            </span>
            <input type="range" min={1} max={3} step={0.05} value={f.zoom} onChange={(e) => setF((p) => ({ ...p, zoom: Number(e.target.value) }))} className="accent-[var(--accent)]" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="v2-btn flex-1" data-tone="accent" disabled={pending} onClick={() => run(() => setFraming(piece.id, f), () => setFraming_(false))}>
              {w.saveFraming}
            </button>
            <button type="button" className="v2-btn" data-tone="ghost" onClick={() => (setF({ fx: piece.focus_x, fy: piece.focus_y, zoom: piece.zoom }), setFraming_(false))}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className={`v2-btn cursor-pointer px-2 text-[0.8rem] ${pending ? "pointer-events-none opacity-60" : ""}`}>
            {w.replace}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  run(async () => {
                    const up = await uploadFiles(preparePortfolioUploads, [file], storage);
                    if (up) return replacePiece(piece.id, up.token, up.keys[0]);
                  });
              }}
            />
          </label>
          <button type="button" className="v2-btn px-2 text-[0.8rem]" data-tone="ghost" onClick={() => setFraming_(true)}>
            {w.framing}
          </button>
          <button type="button" className="v2-btn px-2 text-[0.8rem]" data-tone="danger" onClick={() => setConfirming(true)}>
            {w.remove}
          </button>
        </div>
      )}
      {confirming && (
        <div className="v2-sheet mt-3 grid gap-2 p-4" style={{ borderColor: "var(--accent)" }}>
          <p className="text-[0.9rem]">{w.removeConfirm}</p>
          <div className="flex gap-2">
            <button type="button" className="v2-btn flex-1" data-tone="danger" disabled={pending} onClick={() => run(() => deletePortfolioItem(piece.id), onDeleted)}>
              {w.remove}
            </button>
            <button type="button" className="v2-btn" data-tone="ghost" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
      <form
        className="v2-sheet mt-3 grid gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => quickPiece(piece.id, words));
        }}
      >
        <label className="v2-field">
          <span>{w.title2}</span>
          <input className="v2-input" maxLength={120} value={words.title} onChange={(e) => setWords((p) => ({ ...p, title: e.target.value }))} />
        </label>
        <label className="v2-field">
          <span>{w.story}</span>
          <textarea className="v2-input" maxLength={1200} value={words.story} onChange={(e) => setWords((p) => ({ ...p, story: e.target.value }))} style={{ minHeight: "4.5rem" }} />
        </label>
        {sections.length > 0 && (
          <label className="v2-field">
            <span>{t.studio.live.section}</span>
            <select className="v2-input" value={words.section_id} onChange={(e) => setWords((p) => ({ ...p, section_id: e.target.value }))}>
              <option value="">{t.studio.live.noSection}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center justify-between gap-3 rounded-[14px] border border-bone/15 px-4 py-3">
          <span className="text-[0.95rem]">{t.studio.live.published}</span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={words.published} onChange={(e) => setWords((p) => ({ ...p, published: e.target.checked }))} />
        </label>
        <button type="submit" className="v2-btn justify-self-start" data-tone="ghost" disabled={pending}>
          {t.v2.edit.save}
        </button>
      </form>
      {error && (
        <p role="alert" className="pt-3 text-[0.88rem] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
