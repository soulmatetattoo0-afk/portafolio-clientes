"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { addMagazineMedia, prepareMagazineUploads, quickArtist, saveMagazine } from "@/app/studio/_legacy/actions";
import { uploadFiles, type Storage } from "@/components/edit/upload";
import { boxStyle, CoverSheet, Sheet } from "@/components/magazine/Sheet";
import { fill, type Dict, type Locale } from "@/i18n";
import { styleLabel } from "@/lib/catalog";
import { clampBox, FONT_FAMILY, FONT_LABEL, FONT_STYLE, FONTS, frame, MAX_BOXES, MAX_PAGES, newId, type MagBox, type MagDoc } from "@/lib/magazine";
import type { Artist } from "@/lib/queries";

type Target = -1 | number;
type Shape = "square" | "portrait" | "landscape" | "wide";
const SHAPES: Record<Shape, number> = { square: 1, portrait: 3 / 4, landscape: 4 / 3, wide: 2.6 };

/**
 * Editing the magazine by touch. The cover and the pages as thumbnails; one
 * opens large. Tap a text or a picture and the things it can do appear
 * under the sheet: edit or delete the text (with its face, size, colour and
 * tilt), replace or delete the picture, change its frame or move the photo
 * inside it. Drag anything to move it. Add text, add a picture, add a page
 * (sixteen at most), move it earlier or later, delete it. Save when done.
 */
export function MagEditor({ artist, initial, initialUrls, photos, storage, t, locale, back }: { artist: Artist; initial: MagDoc; initialUrls: Record<string, string>; photos: { key: string; url: string }[]; storage: Storage; t: Dict; locale: Locale; back: string }) {
  const m = t.v2.mag;
  const router = useRouter();
  const [doc, setDoc] = useState<MagDoc>(initial);
  const [urls, setUrls] = useState(initialUrls);
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"text" | "frame" | "photo" | null>(null);
  const [quote, setQuote] = useState(artist.cover_quote ?? "");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; start: MagBox; moved: boolean } | null>(null);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const isCover = target === -1;
  const boxes = target === null ? [] : isCover ? doc.cover.boxes : (doc.pages[target]?.boxes ?? []);
  const box = boxes.find((b) => b.id === selected) ?? null;
  const tone = target === null ? "ink" : isCover ? "ink" : doc.pages[target]?.tone ?? "ink";

  const commit = useCallback((next: MagDoc) => {
    setDoc(next);
    setDirty(true);
    setStatus(null);
  }, []);
  const setBoxes = useCallback(
    (fn: (list: MagBox[]) => MagBox[]) => {
      const d = docRef.current;
      if (target === null) return;
      commit(target === -1 ? { ...d, cover: { ...d.cover, boxes: fn(d.cover.boxes) } } : { ...d, pages: d.pages.map((p, i) => (i === target ? { ...p, boxes: fn(p.boxes) } : p)) });
    },
    [commit, target],
  );
  const patch = (id: string, p: Partial<MagBox>) => setBoxes((list) => list.map((b) => (b.id === id ? clampBox({ ...b, ...p }, isCover) : b)));

  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---------------------------------------------------------------- dragging a box */
  const onBoxDown = (ev: React.PointerEvent, b: MagBox) => {
    ev.stopPropagation();
    setSelected(b.id);
    setPanel(null);
    drag.current = { id: b.id, x: ev.clientX, y: ev.clientY, start: b, moved: false };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    const el = canvas.current;
    if (!d || !el) return;
    const dx = ((ev.clientX - d.x) / el.clientWidth) * 100;
    const dy = ((ev.clientY - d.y) / el.clientHeight) * 100;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 0.6) return;
    d.moved = true;
    setBoxes((list) => list.map((b) => (b.id === d.id ? clampBox({ ...b, x: d.start.x + dx, y: d.start.y + dy }, isCover) : b)));
  };
  const onUp = () => (drag.current = null);

  /* ---------------------------------------------------------------- media */
  const upload = async (files: FileList | null): Promise<{ key: string; url: string } | null> => {
    const file = files?.[0];
    if (!file) return null;
    setBusy(true);
    setError(null);
    try {
      const up = await uploadFiles(prepareMagazineUploads, [file], storage);
      if (!up) throw new Error();
      const [moved] = await addMagazineMedia(up.token, up.keys);
      if (!moved) throw new Error();
      setUrls((u) => ({ ...u, [moved.key]: moved.url }));
      return moved;
    } catch {
      setError(t.v2.edit.error);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const putInBox = (key: string, url: string) => {
    setUrls((u) => ({ ...u, [key]: url }));
    if (box) patch(box.id, { src: key, zoom: 1, fx: 50, fy: 50 });
    else if (target !== null) addImage(key);
  };
  const putPoster = (key: string, url: string) => {
    setUrls((u) => ({ ...u, [key]: url }));
    commit({ ...docRef.current, cover: { ...docRef.current.cover, mode: "poster", poster: key, zoom: 1, fx: 50, fy: 30 } });
  };

  /* ---------------------------------------------------------------- adding */
  const addText = () => {
    if (boxes.length >= MAX_BOXES) return;
    const b = clampBox({ id: newId(), kind: "text", x: 10, y: isCover ? 45 : 40, w: 80, h: 12, text: "", ph: "caption", font: "anton", size: 7, align: "left", dir: "h", rotate: 0, color: tone === "ink" ? "bone" : "ink" }, isCover);
    setBoxes((list) => [...list, b]);
    setSelected(b.id);
    setPanel("text");
  };
  const addImage = (key: string | null) => {
    if (boxes.length >= MAX_BOXES) return;
    const b = clampBox(frame(key, 20, isCover ? 38 : 25, 60, 45), isCover);
    setBoxes((list) => [...list, b]);
    setSelected(b.id);
  };
  const addPage = () => {
    if (doc.pages.length >= MAX_PAGES) return setError(m.maxPages);
    commit({ ...doc, pages: [...doc.pages, { id: newId(), tone: "ink", boxes: [] }] });
    setTarget(doc.pages.length);
    setSelected(null);
  };
  const deletePage = (i: number) => {
    if (doc.pages.length <= 1 || !confirm(m.deletePageConfirm)) return;
    commit({ ...doc, pages: doc.pages.filter((_, k) => k !== i) });
    setTarget(null);
    setSelected(null);
  };
  /** Swap the page with its neighbour; the editor follows it. */
  const movePage = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= doc.pages.length) return;
    const pages = [...doc.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    commit({ ...doc, pages });
    setTarget(j);
  };
  const shapeOf = (b: MagBox): Shape => {
    const r = b.w / (b.h / 1.5);
    return (Object.keys(SHAPES) as Shape[]).reduce((best, k) => (Math.abs(SHAPES[k] - r) < Math.abs(SHAPES[best] - r) ? k : best), "square" as Shape);
  };
  const setShape = (b: MagBox, s: Shape) => patch(b.id, { h: (b.w / SHAPES[s]) * 1.5 });

  /* ---------------------------------------------------------------- saving */
  const save = () =>
    startSave(async () => {
      setError(null);
      const res = await saveMagazine(doc);
      if (res?.error) return setError(res.error);
      if (quote !== (artist.cover_quote ?? "")) await quickArtist({ cover_quote: quote });
      setDirty(false);
      setStatus(m.saved);
      router.refresh();
    });

  const ph = t.magazine.ph;
  const meta = { city: artist.home_city, styles: artist.styles.map((s) => styleLabel(s, locale)), line: quote.trim() || artist.headline?.trim() || null, accent: artist.accent, words: t.magazine.cover };
  const wrap = (b: MagBox, node: React.ReactNode) => (
    <div key={b.id} className={`absolute cursor-move touch-none ${b.id === selected ? "z-30 outline-2 outline-[var(--accent)]" : "outline-1 outline-dashed outline-white/25"}`} style={boxStyle(b)} onPointerDown={(ev) => onBoxDown(ev, b)}>
      {node}
    </div>
  );
  const colorOf = (c: MagBox["color"]) => (c === "accent" ? "var(--accent)" : c === "ink" ? "#0a0a0a" : "#efe7d6");

  return (
    <div className="poster v2-page min-h-dvh" style={{ ["--accent" as string]: artist.accent ?? "#c8231e" }}>
      <header className="v2-top">
        <button type="button" onClick={() => (target !== null ? (setTarget(null), setSelected(null), setPanel(null)) : dirty && !confirm(m.unsaved) ? undefined : router.push(back))} className="grid h-11 w-11 place-items-center text-bone" aria-label={t.v2.front.back}>
          <span aria-hidden className="text-[1.4rem]">←</span>
        </button>
        <h1 className="p-display flex-1 truncate text-[1.5rem] uppercase leading-none">{target === null ? m.title : isCover ? m.editCover : fill(m.page, { n: target + 1 })}</h1>
        <button type="button" onClick={save} disabled={saving || !dirty} className="v2-btn h-10 px-4 text-[0.8rem]" data-tone="accent">
          {saving ? m.saving : status && !dirty ? m.saved : m.save}
        </button>
      </header>

      {target === null ? (
        <div className="px-4 pt-3">
          <p className="pb-3 text-[0.9rem] text-bone-dim">{m.pagesHint}</p>
          <ul className="grid grid-cols-2 gap-3">
            <li>
              <button type="button" onClick={() => setTarget(-1)} className="block w-full overflow-hidden rounded-[10px] text-left shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)]">
                <CoverSheet cover={doc.cover} name={artist.display_name} urls={urls} ph={ph} meta={meta} />
                <span className="block py-2 text-center text-[0.75rem] font-semibold uppercase tracking-[0.1em]">{m.cover}</span>
              </button>
            </li>
            {doc.pages.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setTarget(i)} className="block w-full overflow-hidden rounded-[10px] text-left shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)]">
                  <Sheet page={p} urls={urls} ph={ph} />
                  <span className="block py-2 text-center text-[0.75rem] font-semibold uppercase tracking-[0.1em]">{fill(m.page, { n: i + 1 })}</span>
                </button>
              </li>
            ))}
            {doc.pages.length < MAX_PAGES && (
              <li>
                <button type="button" onClick={addPage} className="grid aspect-[2/3] w-full place-items-center rounded-[10px] border border-dashed border-bone/30 text-[0.85rem] font-semibold text-bone/80">
                  + {m.addPage}
                </button>
              </li>
            )}
          </ul>
          <p className="pt-3 text-[0.78rem] text-bone-dim">{m.maxPages}</p>
        </div>
      ) : (
        <div className="px-3 pt-2">
          <p className="pb-2 text-center text-[0.8rem] text-bone-dim">{m.tapHint}</p>
          <div ref={canvas} className="relative mx-auto w-full max-w-[420px] touch-none select-none overflow-hidden rounded-[8px]" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={() => (setSelected(null), setPanel(null))}>
            {isCover ? <CoverSheet cover={doc.cover} name={artist.display_name} urls={urls} ph={ph} meta={meta} wrap={wrap} /> : <Sheet page={doc.pages[target]} urls={urls} ph={ph} wrap={wrap} />}
          </div>

          {/* What the chosen thing can do */}
          <div className="v2-sheet mt-3 grid gap-3 p-3">
            {box?.kind === "text" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone={panel === "text" ? "accent" : "ghost"} onClick={() => setPanel(panel === "text" ? null : "text")}>
                    {m.editText}
                  </button>
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="danger" onClick={() => (setBoxes((l) => l.filter((b) => b.id !== box.id)), setSelected(null))}>
                    {m.deleteText}
                  </button>
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="ghost" onClick={() => setBoxes((l) => [...l.filter((b) => b.id !== box.id), box])}>
                    {m.layer}
                  </button>
                </div>
                {panel === "text" && (
                  <div className="grid gap-3">
                    <textarea className="v2-input" value={box.text ?? ""} placeholder={m.writeHere} maxLength={4000} onChange={(e) => patch(box.id, { text: e.target.value })} style={{ minHeight: "4.5rem" }} />
                    <div>
                      <p className="p-stamp mb-1.5 text-bone/60">{m.font}</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                        {FONTS.map((f) => (
                          <button key={f} type="button" aria-pressed={(box.font ?? "sans") === f} onClick={() => patch(box.id, { font: f })} className="shrink-0 rounded-[12px] border border-bone/20 px-3 py-2 text-[1rem] leading-none aria-pressed:border-accent aria-pressed:bg-accent/15" style={{ ...FONT_STYLE[f], fontFamily: FONT_FAMILY[f], lineHeight: 1 }}>
                            {FONT_LABEL[f]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="v2-field">
                        <span>{m.size}</span>
                        <input type="range" min={1.5} max={30} step={0.1} value={box.size ?? 3.6} onChange={(e) => patch(box.id, { size: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.rotate}</span>
                        <input type="range" min={-45} max={45} step={1} value={box.rotate ?? 0} onChange={(e) => patch(box.id, { rotate: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.width}</span>
                        <input type="range" min={10} max={92} step={1} value={box.w} onChange={(e) => patch(box.id, { w: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.height}</span>
                        <input type="range" min={3} max={92} step={0.5} value={box.h} onChange={(e) => patch(box.id, { h: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                      <div className="v2-field">
                        <span>{m.align}</span>
                        <div className="flex gap-1">
                          {(["left", "center", "right"] as const).map((a) => (
                            <button key={a} type="button" aria-pressed={(box.align ?? "left") === a} onClick={() => patch(box.id, { align: a })} className="h-9 flex-1 rounded-[10px] border border-bone/20 text-[0.8rem] aria-pressed:bg-bone aria-pressed:text-ink">
                              {a === "left" ? "≡" : a === "center" ? "☰" : "≡"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="v2-field">
                      <span>{m.color}</span>
                      <div className="flex gap-2">
                        {(["bone", "ink", "accent"] as const).map((c) => (
                          <button key={c} type="button" aria-pressed={(box.color ?? "bone") === c} onClick={() => patch(box.id, { color: c })} className="h-9 w-9 rounded-full border-2 border-bone/30 aria-pressed:border-accent" style={{ background: colorOf(c) }} aria-label={c === "bone" ? m.toneBone : c === "ink" ? m.toneInk : m.toneAccent} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {box?.kind === "media" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <label className={`v2-btn h-10 cursor-pointer text-[0.8rem] ${busy ? "pointer-events-none opacity-60" : ""}`} data-tone="ghost">
                    {m.replaceImage}
                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={async (e) => { const r = await upload(e.target.files); if (r) putInBox(r.key, r.url); e.target.value = ""; }} />
                  </label>
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone={panel === "frame" ? "accent" : "ghost"} onClick={() => setPanel(panel === "frame" ? null : "frame")}>
                    {m.frame}
                  </button>
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone={panel === "photo" ? "accent" : "ghost"} onClick={() => setPanel(panel === "photo" ? null : "photo")}>
                    {m.photo}
                  </button>
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="danger" onClick={() => (setBoxes((l) => l.filter((b) => b.id !== box.id)), setSelected(null))}>
                    {m.deleteImage}
                  </button>
                </div>
                {panel === "frame" && (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(SHAPES) as Shape[]).map((s) => (
                        <button key={s} type="button" aria-pressed={shapeOf(box) === s} onClick={() => setShape(box, s)} className="rounded-full border border-bone/20 px-3 py-1.5 text-[0.8rem] aria-pressed:bg-bone aria-pressed:text-ink">
                          {s === "square" ? m.frameSquare : s === "portrait" ? m.framePortrait : s === "landscape" ? m.frameLandscape : m.frameWide}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="v2-field">
                        <span>{m.width}</span>
                        <input type="range" min={10} max={92} step={1} value={box.w} onChange={(e) => patch(box.id, { w: Number(e.target.value), h: (box.h * Number(e.target.value)) / box.w })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.height}</span>
                        <input type="range" min={5} max={92} step={0.5} value={box.h} onChange={(e) => patch(box.id, { h: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                    </div>
                  </div>
                )}
                {panel === "photo" && (
                  <div className="grid gap-3">
                    <label className="v2-field">
                      <span>{m.zoom}</span>
                      <input type="range" min={1} max={3} step={0.05} value={box.zoom ?? 1} onChange={(e) => patch(box.id, { zoom: Number(e.target.value) })} className="accent-[var(--accent)]" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="v2-field">
                        <span>{m.position} ←→</span>
                        <input type="range" min={0} max={100} value={box.fx ?? 50} onChange={(e) => patch(box.id, { fx: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.position} ↑↓</span>
                        <input type="range" min={0} max={100} value={box.fy ?? 50} onChange={(e) => patch(box.id, { fy: Number(e.target.value) })} className="accent-[var(--accent)]" />
                      </label>
                    </div>
                    <p className="p-stamp text-bone/60">{m.fromWork}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                      {photos.map((p) => (
                        <button key={p.key} type="button" onClick={() => putInBox(p.key, p.url)} className="h-16 w-14 shrink-0 overflow-hidden rounded-[10px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {!box && (
              <div className="grid gap-3">
                {isCover && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <label className={`v2-btn h-10 cursor-pointer text-[0.8rem] ${busy ? "pointer-events-none opacity-60" : ""}`} data-tone="ghost">
                        {m.coverPhoto}: {m.replaceImage}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const r = await upload(e.target.files); if (r) putPoster(r.key, r.url); e.target.value = ""; }} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="v2-field">
                        <span>{m.zoom}</span>
                        <input type="range" min={1} max={3} step={0.05} value={doc.cover.zoom ?? 1} onChange={(e) => commit({ ...doc, cover: { ...doc.cover, zoom: Number(e.target.value) } })} className="accent-[var(--accent)]" />
                      </label>
                      <label className="v2-field">
                        <span>{m.position} ↑↓</span>
                        <input type="range" min={0} max={100} value={doc.cover.fy ?? 30} onChange={(e) => commit({ ...doc, cover: { ...doc.cover, fy: Number(e.target.value) } })} className="accent-[var(--accent)]" />
                      </label>
                    </div>
                    <label className="v2-field">
                      <span>{m.quote}</span>
                      <input className="v2-input" maxLength={160} value={quote} onChange={(e) => (setQuote(e.target.value), setDirty(true))} />
                    </label>
                  </>
                )}
                {!isCover && (
                  <div className="v2-field">
                    <span>{m.paper}</span>
                    <div className="flex gap-2">
                      {(["ink", "bone"] as const).map((tn) => (
                        <button key={tn} type="button" aria-pressed={doc.pages[target]?.tone === tn} onClick={() => commit({ ...doc, pages: doc.pages.map((p, i) => (i === target ? { ...p, tone: tn } : p)) })} className="rounded-full border border-bone/20 px-3 py-1.5 text-[0.8rem] aria-pressed:bg-bone aria-pressed:text-ink">
                          {tn === "ink" ? m.ink : m.bone}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="accent" onClick={addText}>
                    + {m.addText}
                  </button>
                  <label className={`v2-btn h-10 cursor-pointer text-[0.8rem] ${busy ? "pointer-events-none opacity-60" : ""}`} data-tone="accent">
                    + {m.addImage}
                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={async (e) => { const r = await upload(e.target.files); if (r) { setUrls((u) => ({ ...u, [r.key]: r.url })); addImage(r.key); } e.target.value = ""; }} />
                  </label>
                  {!isCover && (
                    <>
                      <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="ghost" disabled={target === 0} onClick={() => movePage(target, -1)}>
                        {m.movePrev}
                      </button>
                      <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="ghost" disabled={target === doc.pages.length - 1} onClick={() => movePage(target, 1)}>
                        {m.moveNext}
                      </button>
                    </>
                  )}
                  {!isCover && (
                    <button type="button" className="v2-btn h-10 text-[0.8rem]" data-tone="danger" onClick={() => deletePage(target)}>
                      {m.deletePage}
                    </button>
                  )}
                </div>
                {photos.length > 0 && (
                  <div>
                    <p className="p-stamp mb-1.5 text-bone/60">{m.fromWork}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                      {photos.map((p) => (
                        <button key={p.key} type="button" onClick={() => (isCover && !doc.cover.poster ? putPoster(p.key, p.url) : (setUrls((u) => ({ ...u, [p.key]: p.url })), addImage(p.key)))} className="h-16 w-14 shrink-0 overflow-hidden rounded-[10px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-[0.88rem] text-accent">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
