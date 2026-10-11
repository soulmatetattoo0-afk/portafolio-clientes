"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { CoverSheet, Media, Sheet, boxStyle } from "@/components/magazine/Sheet";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import {
  COVER_TOP,
  FONTS,
  FONT_FAMILY,
  FONT_STYLE,
  MAX_BOXES,
  MAX_PAGES,
  SAFE,
  clampBox,
  frame,
  newId,
  type FontId,
  type MagBox,
  type MagDoc,
} from "@/lib/magazine";

import { addMagazineMedia, prepareMagazineUploads, resetMagazine, saveMagazine } from "../actions";

type T = Dict["magazine"];
/** -1 is the cover; 0… are the pages. */
type Target = number;
type Corner = "nw" | "ne" | "sw" | "se";

const PHOTO = ["image/jpeg", "image/png", "image/webp"];
const VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const HISTORY = 60;

/**
 * The magazine on the table. One sheet at a time: tap a box to pick it,
 * drag it to move it, pull a corner to resize it; the panel beside it holds
 * everything else (the photo or video, its framing, the words, the face,
 * size, direction, angle and colour). Nothing leaves the printable area,
 * and the cover keeps our masthead whatever happens below it.
 */
export function MagazineEditor({
  initial,
  initialUrls,
  library,
  name,
  slug,
  accent,
  t,
  storage,
}: {
  initial: MagDoc;
  initialUrls: Record<string, string>;
  library: { key: string; url: string }[];
  name: string;
  slug: string;
  accent: string;
  t: T;
  storage: { url: string; anonKey: string } | null;
}) {
  const e = t.editor;
  const [doc, setDoc] = useState<MagDoc>(initial);
  const [urls, setUrls] = useState(initialUrls);
  const [target, setTarget] = useState<Target>(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const past = useRef<MagDoc[]>([]);
  const future = useRef<MagDoc[]>([]);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: "move" | Corner; x: number; y: number; start: MagBox; before: MagDoc; moved: boolean } | null>(null);

  const isCover = target === -1;
  const boxes = isCover ? doc.cover.boxes : (doc.pages[target]?.boxes ?? []);
  const box = boxes.find((b) => b.id === selected) ?? null;

  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  /** Every edit goes through here: one step of undo, and the page is dirty. */
  const commit = useCallback((next: MagDoc, before?: MagDoc) => {
    past.current = [...past.current.slice(-HISTORY), before ?? docRef.current];
    future.current = [];
    setDoc(next);
    setDirty(true);
    setStatus(null);
  }, []);

  const setBoxes = useCallback(
    (fn: (list: MagBox[]) => MagBox[], before?: MagDoc) => {
      const d = docRef.current;
      const next: MagDoc =
        target === -1 ? { ...d, cover: { ...d.cover, boxes: fn(d.cover.boxes) } } : { ...d, pages: d.pages.map((p, i) => (i === target ? { ...p, boxes: fn(p.boxes) } : p)) };
      commit(next, before);
    },
    [commit, target],
  );
  const patch = (id: string, p: Partial<MagBox>) => setBoxes((list) => list.map((b) => (b.id === id ? clampBox({ ...b, ...p }, isCover) : b)));

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(docRef.current);
    setDoc(prev);
    setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(docRef.current);
    setDoc(next);
    setDirty(true);
  }, []);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keys: undo and redo, delete the picked box, arrows nudge it.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) redo();
        else undo();
        return;
      }
      if (!selected) return;
      if (ev.key === "Backspace" || ev.key === "Delete") {
        ev.preventDefault();
        setBoxes((list) => list.filter((b) => b.id !== selected));
        setSelected(null);
        return;
      }
      const step = ev.shiftKey ? 2 : 0.5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (d) {
        ev.preventDefault();
        setBoxes((list) => list.map((b) => (b.id === selected ? clampBox({ ...b, x: b.x + d[0], y: b.y + d[1] }, target === -1) : b)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, setBoxes, undo, redo, target]);

  /* ---------------------------------------------------------------- dragging */

  const onBoxDown = (ev: React.PointerEvent, b: MagBox, mode: "move" | Corner) => {
    ev.stopPropagation();
    ev.preventDefault();
    setSelected(b.id);
    canvas.current?.setPointerCapture(ev.pointerId);
    drag.current = { id: b.id, mode, x: ev.clientX, y: ev.clientY, start: b, before: docRef.current, moved: false };
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    const rect = canvas.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = ((ev.clientX - d.x) / rect.width) * 100;
    const dy = ((ev.clientY - d.y) / rect.height) * 100;
    if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 3) return;
    d.moved = true;
    const s = d.start;
    let n: MagBox;
    if (d.mode === "move") {
      n = { ...s, x: s.x + dx, y: s.y + dy };
      // Snap the centre to the middle of the page when close.
      const cx = n.x + n.w / 2;
      if (Math.abs(cx - 50) < 1.2) n.x = 50 - n.w / 2;
    } else {
      const west = d.mode === "nw" || d.mode === "sw";
      const north = d.mode === "nw" || d.mode === "ne";
      const w = Math.max(6, west ? s.w - dx : s.w + dx);
      const h = Math.max(4, north ? s.h - dy : s.h + dy);
      n = { ...s, w, h, x: west ? s.x + s.w - w : s.x, y: north ? s.y + s.h - h : s.y };
    }
    n = clampBox(n, target === -1);
    const d0 = docRef.current;
    const swap = (list: MagBox[]) => list.map((b) => (b.id === d.id ? n : b));
    // Live while dragging; the undo step is taken once, on release.
    setDoc(target === -1 ? { ...d0, cover: { ...d0.cover, boxes: swap(d0.cover.boxes) } } : { ...d0, pages: d0.pages.map((p, i) => (i === target ? { ...p, boxes: swap(p.boxes) } : p)) });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    past.current = [...past.current.slice(-HISTORY), d.before];
    future.current = [];
    setDirty(true);
    setStatus(null);
  };

  /* ---------------------------------------------------------------- adding */

  const addFrame = () => {
    if (boxes.length >= MAX_BOXES) return;
    const b = clampBox(frame(null, 28, isCover ? 40 : 30, 44, 30), isCover);
    setBoxes((list) => [...list, b]);
    setSelected(b.id);
  };
  const addText = () => {
    if (boxes.length >= MAX_BOXES) return;
    const tone = isCover ? doc.cover.tone : doc.pages[target].tone;
    const b = clampBox(
      { id: newId(), kind: "text", x: 12, y: isCover ? 70 : 42, w: 76, h: 12, text: "", ph: "caption", font: "serif", size: 4.4, align: "left", dir: "h", rotate: 0, color: tone === "ink" ? "bone" : "ink" },
      isCover,
    );
    setBoxes((list) => [...list, b]);
    setSelected(b.id);
  };
  const clearPage = () => {
    if (!boxes.length || !confirm(e.clearConfirm)) return;
    setBoxes(() => []);
    setSelected(null);
  };

  /* ---------------------------------------------------------------- pages */

  const addPage = () => {
    if (doc.pages.length >= MAX_PAGES) return;
    commit({ ...doc, pages: [...doc.pages, { id: newId(), tone: "ink", boxes: [] }] });
    setTarget(doc.pages.length);
    setSelected(null);
  };
  const deletePage = () => {
    if (isCover || doc.pages.length <= 1 || !confirm(e.deletePageConfirm)) return;
    commit({ ...doc, pages: doc.pages.filter((_, i) => i !== target) });
    setTarget(Math.max(0, target - 1));
    setSelected(null);
  };
  const movePage = (dir: -1 | 1) => {
    const to = target + dir;
    if (isCover || to < 0 || to >= doc.pages.length) return;
    const pages = [...doc.pages];
    [pages[target], pages[to]] = [pages[to], pages[target]];
    commit({ ...doc, pages });
    setTarget(to);
  };
  const setTone = (tone: "ink" | "bone") =>
    commit(isCover ? { ...doc, cover: { ...doc.cover, tone } } : { ...doc, pages: doc.pages.map((p, i) => (i === target ? { ...p, tone } : p)) });

  /* ---------------------------------------------------------------- media */

  const upload = async (files: FileList | null): Promise<{ key: string; url: string } | null> => {
    const file = files?.[0];
    if (!file) return null;
    setError(null);
    const video = VIDEO.includes(file.type);
    if (!PHOTO.includes(file.type) && !video) {
      setError(e.badType);
      return null;
    }
    if (file.size > (video ? 60 : 10) * 1024 * 1024) {
      setError(e.tooBig);
      return null;
    }
    setUploading(true);
    try {
      const prepared = await prepareMagazineUploads([{ type: file.type, size: file.size }]);
      const target = prepared?.targets[0];
      if (!prepared || !target) throw new Error();
      if (storage && target.token && target.bucket) {
        const supabase = (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey);
        const { error: err } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, file, { contentType: file.type });
        if (err) throw err;
      } else if (target.url) {
        const res = await fetch(target.url, { method: "PUT", body: file, headers: { "content-type": file.type } });
        if (!res.ok) throw new Error();
      }
      const [moved] = await addMagazineMedia(prepared.token, [target.key]);
      if (!moved) throw new Error();
      setUrls((u) => ({ ...u, [moved.key]: moved.url }));
      return moved;
    } catch {
      setError(e.badType);
      return null;
    } finally {
      setUploading(false);
    }
  };
  const putMedia = (key: string, url: string) => {
    setUrls((u) => ({ ...u, [key]: url }));
    if (box) patch(box.id, { src: key, zoom: 1, fx: 50, fy: 50 });
  };
  const putPoster = (key: string, url: string) => {
    setUrls((u) => ({ ...u, [key]: url }));
    commit({ ...doc, cover: { ...doc.cover, poster: key, zoom: 1, fx: 50, fy: 50 } });
  };

  /* ---------------------------------------------------------------- saving */

  const save = () =>
    startSave(async () => {
      setError(null);
      const res = await saveMagazine(doc);
      if (res?.error) setError(res.error);
      else {
        setDirty(false);
        setStatus(e.saved);
      }
    });
  const reset = () => {
    if (!confirm(e.resetConfirm)) return;
    startSave(async () => {
      await resetMagazine();
      window.location.reload();
    });
  };

  /* ---------------------------------------------------------------- render */

  const wrap = (b: MagBox, node: React.ReactNode) => {
    const on = b.id === selected;
    return (
      <div
        key={b.id}
        className={`absolute cursor-move touch-none ${on ? "z-30 outline-2 outline-offset-0 outline-[var(--color-gilt)]" : "outline-1 outline-dashed outline-white/25 hover:outline-white/60"}`}
        style={boxStyle(b)}
        onPointerDown={(ev) => onBoxDown(ev, b, "move")}
      >
        {node}
        {b.kind === "media" && !b.src && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-center text-[0.75rem] text-bone/70">+ {e.frame}</span>
        )}
        {on &&
          (["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
            <span
              key={c}
              role="presentation"
              onPointerDown={(ev) => onBoxDown(ev, b, c)}
              className="absolute z-40 h-4 w-4 rounded-full border-2 border-[var(--color-gilt)] bg-soot sm:h-3.5 sm:w-3.5"
              style={{
                left: c.endsWith("w") ? 0 : "100%",
                top: c.startsWith("n") ? 0 : "100%",
                transform: "translate(-50%,-50%)",
                cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
              }}
            />
          ))}
      </div>
    );
  };

  /** The printable area, and on the cover the masthead's band, drawn over the sheet while editing. */
  const guides = (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute border border-dashed border-sky-300/40" style={{ left: `${SAFE}%`, right: `${SAFE}%`, top: `${isCover ? COVER_TOP : SAFE}%`, bottom: `${SAFE}%` }} />
      <div className="absolute inset-y-0 left-1/2 border-l border-dotted border-sky-300/20" />
    </div>
  );

  const shape = (ratio: number) => {
    if (!box) return;
    // ratio is width ÷ height in real pixels; the sheet is 2:3, so a percent of height is 1.5× a percent of width.
    const h = (box.w / ratio) * (2 / 3);
    patch(box.id, { h });
  };

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      {/* The bar: undo, save, see it live. */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? e.saving : e.save}
        </button>
        <span className="text-[0.85rem] text-ash" role="status">
          {dirty ? e.unsaved : status}
        </span>
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={undo} title="⌘Z">
          {e.undo}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={redo} title="⇧⌘Z">
          {e.redo}
        </button>
        <a href={`/${slug}#bio`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          {e.view}
        </a>
      </div>
      {error && (
        <p role="alert" className="text-[0.9rem] text-oxblood">
          {error}
        </p>
      )}

      {/* The pages as a strip of thumbnails. */}
      <div className="poster -mx-4 overflow-x-auto bg-transparent! px-4 [scrollbar-width:thin]" style={{ ["--accent" as string]: accent }}>
        <ol className="flex items-end gap-3 pb-2">
          <li>
            <Thumb on={isCover} label={e.cover} onClick={() => (setTarget(-1), setSelected(null))}>
              <CoverSheet cover={doc.cover} name={name} urls={urls} ph={t.ph} />
            </Thumb>
          </li>
          {doc.pages.map((p, i) => (
            <li key={p.id}>
              <Thumb on={target === i} label={fill(e.page, { n: i + 1 })} onClick={() => (setTarget(i), setSelected(null))}>
                <Sheet page={p} urls={urls} ph={t.ph} />
              </Thumb>
            </li>
          ))}
          <li>
            <button type="button" onClick={addPage} disabled={doc.pages.length >= MAX_PAGES} className="relative grid aspect-[2/3] w-[64px] place-items-center rounded-[6px] border border-dashed border-line-strong text-[1.4rem] text-ash hover:text-vellum">
              <span aria-hidden>+</span>
              <span className="sr-only">{e.addPage}</span>
            </button>
          </li>
        </ol>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        {/* The sheet on the table. */}
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!(isCover && doc.cover.mode === "poster") && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addFrame}>
                  + {e.addFrame}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addText}>
                  + {e.addText}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearPage}>
                  {e.clear}
                </button>
              </>
            )}
            <span className="flex-1" />
            <div className="seg" role="group" aria-label={e.paper}>
              {(["ink", "bone"] as const).map((tone) => (
                <button key={tone} type="button" aria-pressed={(isCover ? doc.cover.tone : doc.pages[target]?.tone) === tone} onClick={() => setTone(tone)}>
                  {tone === "ink" ? e.ink : e.bone}
                </button>
              ))}
            </div>
          </div>

          {isCover && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-label">{e.coverMode}</span>
              <div className="seg" role="group" aria-label={e.coverMode}>
                {(["compose", "poster"] as const).map((mode) => (
                  <button key={mode} type="button" aria-pressed={doc.cover.mode === mode} onClick={() => (commit({ ...doc, cover: { ...doc.cover, mode } }), setSelected(null))}>
                    {mode === "compose" ? e.compose : e.poster}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="poster mx-auto w-full max-w-[520px] bg-transparent!" style={{ ["--accent" as string]: accent }}>
            <div ref={canvas} className="relative touch-none select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={() => setSelected(null)}>
              {isCover ? (
                <CoverSheet cover={doc.cover} name={name} urls={urls} ph={t.ph} wrap={wrap} className="rounded-[4px]">
                  {doc.cover.mode === "compose" && guides}
                </CoverSheet>
              ) : (
                <Sheet page={doc.pages[target]} urls={urls} ph={t.ph} wrap={wrap} className="rounded-[4px]">
                  {guides}
                </Sheet>
              )}
            </div>
          </div>

          {!isCover && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => movePage(-1)} disabled={target === 0}>
                ← {e.moveLeft}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => movePage(1)} disabled={target === doc.pages.length - 1}>
                {e.moveRight} →
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={deletePage} disabled={doc.pages.length <= 1}>
                {e.deletePage}
              </button>
            </div>
          )}
        </div>

        {/* The inspector. */}
        <aside className="grid gap-5 rounded-[var(--radius)] border border-line bg-niche p-4 lg:sticky lg:top-6">
          {isCover && doc.cover.mode === "poster" ? (
            <section className="grid gap-4">
              <p className="text-[0.9rem] text-ash">{e.posterHint}</p>
              <MediaPicker t={e} uploading={uploading} library={library} onUpload={async (f) => { const m = await upload(f); if (m) putPoster(m.key, m.url); }} onPick={putPoster} />
              {doc.cover.poster && (
                <Framing
                  t={e}
                  zoom={doc.cover.zoom ?? 1}
                  fx={doc.cover.fx ?? 50}
                  fy={doc.cover.fy ?? 50}
                  onChange={(p) => setDoc({ ...doc, cover: { ...doc.cover, ...p } })}
                  onCommit={() => (setDirty(true), setStatus(null))}
                />
              )}
            </section>
          ) : !box ? (
            <p className="text-[0.9rem] text-ash">{e.selectHint}</p>
          ) : box.kind === "media" ? (
            <section className="grid gap-4">
              <p className="t-label">{e.frame}</p>
              {box.src && urls[box.src] && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-[6px]">
                  <Media src={box.src} url={urls[box.src]} zoom={box.zoom} fx={box.fx} fy={box.fy} alt="" />
                </div>
              )}
              <MediaPicker t={e} uploading={uploading} library={library} onUpload={async (f) => { const m = await upload(f); if (m) putMedia(m.key, m.url); }} onPick={putMedia} />
              {box.src && (
                <Framing
                  t={e}
                  zoom={box.zoom ?? 1}
                  fx={box.fx ?? 50}
                  fy={box.fy ?? 50}
                  onChange={(p) => setDoc(liveBox(doc, target, box.id, p))}
                  onCommit={() => (setDirty(true), setStatus(null))}
                />
              )}
              <div className="grid gap-2">
                <span className="t-label">{e.shape}</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="chip" onClick={() => shape(1)}>
                    {e.square}
                  </button>
                  <button type="button" className="chip" onClick={() => shape(3 / 4)}>
                    {e.portrait}
                  </button>
                  <button type="button" className="chip" onClick={() => shape(4 / 3)}>
                    {e.landscape}
                  </button>
                  <button type="button" className="chip" onClick={() => shape(1 / 2.6)}>
                    {e.strip}
                  </button>
                </div>
              </div>
              <BoxActions t={e} onFront={() => order(1)} onBack={() => order(-1)} onDuplicate={duplicate} onRemove={remove} />
            </section>
          ) : (
            <section className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="t-label">{e.text}</span>
                <textarea
                  className="input min-h-28"
                  value={box.text ?? ""}
                  placeholder={box.ph ? t.ph[box.ph] : e.writeHere}
                  onChange={(ev) => patch(box.id, { text: ev.target.value })}
                  maxLength={4000}
                />
              </label>
              <div className="grid gap-2">
                <span className="t-label">{e.font}</span>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map((f: FontId) => (
                    <button
                      key={f}
                      type="button"
                      className="chip justify-center"
                      aria-pressed={(box.font ?? "sans") === f}
                      onClick={() => patch(box.id, { font: f })}
                      style={{ ...FONT_STYLE[f], fontFamily: FONT_FAMILY[f], lineHeight: 1, fontSize: f === "script" ? "1.25rem" : "1rem" }}
                    >
                      {e.fonts[f]}
                    </button>
                  ))}
                </div>
              </div>
              <Range label={e.size} min={1.5} max={30} step={0.1} value={box.size ?? 3.6} onChange={(v) => setDoc(liveBox(doc, target, box.id, { size: v }))} onCommit={() => setDirty(true)} />
              <Choice label={e.align} value={box.align ?? "left"} options={[["left", e.left], ["center", e.center], ["right", e.right]]} onChange={(v) => patch(box.id, { align: v })} />
              <Choice label={e.direction} value={box.dir ?? "h"} options={[["h", e.horizontal], ["v", e.down], ["up", e.up]]} onChange={(v) => patch(box.id, { dir: v })} />
              <Range label={e.angle} min={-90} max={90} step={1} value={box.rotate ?? 0} onChange={(v) => setDoc(liveBox(doc, target, box.id, { rotate: v }))} onCommit={() => setDirty(true)} suffix="°" />
              <Choice label={e.color} value={box.color ?? "bone"} options={[["bone", e.bone], ["ink", e.ink], ["accent", e.accent]]} onChange={(v) => patch(box.id, { color: v })} />
              <BoxActions t={e} onFront={() => order(1)} onBack={() => order(-1)} onDuplicate={duplicate} onRemove={remove} />
            </section>
          )}
          <button type="button" className="btn btn-ghost btn-sm justify-self-start text-ash" onClick={reset}>
            {e.reset}
          </button>
        </aside>
      </div>
    </div>
  );

  function order(dir: 1 | -1) {
    if (!box) return;
    setBoxes((list) => {
      const rest = list.filter((b) => b.id !== box.id);
      return dir === 1 ? [...rest, box] : [box, ...rest];
    });
  }
  function duplicate() {
    if (!box || boxes.length >= MAX_BOXES) return;
    const copy = clampBox({ ...box, id: newId(), x: box.x + 3, y: box.y + 3 }, isCover);
    setBoxes((list) => [...list, copy]);
    setSelected(copy.id);
  }
  function remove() {
    if (!box) return;
    setBoxes((list) => list.filter((b) => b.id !== box.id));
    setSelected(null);
  }
}

/** Change one box without taking an undo step (sliders mid-drag). */
function liveBox(doc: MagDoc, target: Target, id: string, p: Partial<MagBox>): MagDoc {
  const swap = (list: MagBox[]) => list.map((b) => (b.id === id ? { ...b, ...p } : b));
  return target === -1 ? { ...doc, cover: { ...doc.cover, boxes: swap(doc.cover.boxes) } } : { ...doc, pages: doc.pages.map((pg, i) => (i === target ? { ...pg, boxes: swap(pg.boxes) } : pg)) };
}

function Thumb({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="group grid w-[64px] gap-1 text-left">
      <span className={`pointer-events-none block overflow-hidden rounded-[4px] ring-2 transition ${on ? "ring-[var(--color-gilt)]" : "ring-transparent group-hover:ring-white/30"}`}>{children}</span>
      <span className={`truncate text-[0.7rem] ${on ? "text-vellum" : "text-ash"}`}>{label}</span>
    </button>
  );
}

function MediaPicker({ t, uploading, library, onUpload, onPick }: { t: Dict["magazine"]["editor"]; uploading: boolean; library: { key: string; url: string }[]; onUpload: (f: FileList | null) => void; onPick: (key: string, url: string) => void }) {
  return (
    <div className="grid gap-3">
      <label className={`btn btn-secondary btn-sm cursor-pointer justify-self-start ${uploading ? "pointer-events-none opacity-60" : ""}`} aria-busy={uploading}>
        {uploading ? t.uploading : t.upload}
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(ev) => (onUpload(ev.target.files), (ev.target.value = ""))} disabled={uploading} />
      </label>
      {library.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[0.85rem] text-ash">{t.fromPortfolio}</summary>
          <ul className="mt-2 grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto">
            {library.map((m) => (
              <li key={m.key}>
                <button type="button" onClick={() => onPick(m.key, m.url)} className="block aspect-square w-full overflow-hidden rounded-[4px] hover:ring-2 hover:ring-[var(--color-gilt)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Framing({ t, zoom, fx, fy, onChange, onCommit }: { t: Dict["magazine"]["editor"]; zoom: number; fx: number; fy: number; onChange: (p: { zoom?: number; fx?: number; fy?: number }) => void; onCommit: () => void }) {
  return (
    <div className="grid gap-3">
      <Range label={t.zoom} min={1} max={4} step={0.01} value={zoom} onChange={(v) => onChange({ zoom: v })} onCommit={onCommit} suffix="×" />
      <Range label={t.focusX} min={0} max={100} step={1} value={fx} onChange={(v) => onChange({ fx: v })} onCommit={onCommit} />
      <Range label={t.focusY} min={0} max={100} step={1} value={fy} onChange={(v) => onChange({ fy: v })} onCommit={onCommit} />
    </div>
  );
}

function Range({ label, min, max, step, value, onChange, onCommit, suffix = "" }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; onCommit: () => void; suffix?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex justify-between">
        <span className="t-label">{label}</span>
        <span className="t-num text-[0.8rem] text-ash">
          {step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : Math.round(value)}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(ev) => onChange(Number(ev.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} className="accent-[var(--color-gilt)]" />
    </label>
  );
}

function Choice<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="t-label">{label}</span>
      <div className="seg flex-wrap justify-self-start" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoxActions({ t, onFront, onBack, onDuplicate, onRemove }: { t: Dict["magazine"]["editor"]; onFront: () => void; onBack: () => void; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onFront}>
        {t.front}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
        {t.back}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDuplicate}>
        {t.duplicate}
      </button>
      <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
        {t.remove}
      </button>
    </div>
  );
}
