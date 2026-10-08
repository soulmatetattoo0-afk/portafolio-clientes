"use client";

import gsap from "gsap";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { locate } from "./cities";
import { edgePoint, inBox, project, stateAt, WORLD_FRAME, type Box, type Frame } from "./frame";
import { BORDERS, STATES } from "./regions";
import { GRATICULE, LAND, LAND_SKETCH, WORLD_H, WORLD_W } from "./world";

export interface Pin {
  /** The stop's id; what `onPick` gets back. */
  id: string;
  city: string;
  country: string;
  kind: "home" | "stop";
  /** First day of the stop, so an off-map stop can say when. */
  on: string | null;
}

/** How the map is drawn: ink on paper, by hand, or the gold world of the deck. */
export type MapMode = "paper" | "ink";

export interface MapLabels {
  zoomIn: string;
  zoomOut: string;
  world: string;
}

/** The world box stretched to the frame's shape, so the zoom starts from the whole world and never letterboxes. */
function worldFor(frame: Frame): Box {
  const aspect = frame.box[2] / frame.box[3];
  const h = WORLD_W / aspect;
  return h >= WORLD_H ? [0, (WORLD_H - h) / 2, WORLD_W, h] : [(WORLD_W - WORLD_H * aspect) / 2, 0, WORLD_H * aspect, WORLD_H];
}

/** How far in the map may go: three times closer than the frame of the stops. */
const MAX_ZOOM = 3;
/** A pointer that moves less than this before it lifts is a tap, not a drag. */
const TAP_SLOP = 6;
/**
 * The drawing under the pins is heavy (every coast, border and state), so it is
 * painted once per move, with this much margin around the view, and slid and
 * scaled as a bitmap in between. It is painted again when the view leaves that
 * margin or grows past SHARP, where the upscaling would start to show.
 */
const MARGIN = 1.5;
const SHARP = 1.8;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (b: Box) => b.map((n) => n.toFixed(2)).join(" ");
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** A box grown by MARGIN around its centre: what the drawing is painted for. */
const grown = (b: Box): Box => [b[0] - (b[2] * (MARGIN - 1)) / 2, b[1] - (b[3] * (MARGIN - 1)) / 2, b[2] * MARGIN, b[3] * MARGIN];
const within = (outer: Box, b: Box) => b[0] >= outer[0] - 0.01 && b[1] >= outer[1] - 0.01 && b[0] + b[2] <= outer[0] + outer[2] + 0.01 && b[1] + b[3] <= outer[1] + outer[3] + 0.01;
/** How the region's lines and the names come in with the zoom: nothing at the whole world, all of it by the frame. */
const layerOpacity = (z: number) => clamp01((z - 0.3) / 0.5);
const labelOpacity = (z: number) => clamp01((z - 0.3) / 0.35);

/** A five-point star around the origin, for the home mark. */
function star(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
const STAR = star(5);

/**
 * The world with the artist's home and the cities on the tour, and flight
 * lines from home to each stop. Given a `frame`, it opens on the whole world,
 * flies in to that region, draws its states or borders, and names each stop;
 * from there it can be pinched, dragged and zoomed between the whole world and
 * three times closer than the frame. Stops beyond the view wait at its edge.
 *
 * The camera never goes through React while it moves: gestures and tweens
 * write the viewBox and the pins' scale straight on the elements, slide the
 * drawing underneath as a bitmap, and React is told once, when the move is over.
 */
export function WorldMap({
  pins,
  className = "",
  lines = true,
  frame,
  active = null,
  onPick,
  label,
  later,
  mode = "ink",
  labels,
}: {
  pins: Pin[];
  className?: string;
  lines?: boolean;
  frame?: Frame;
  active?: string | null;
  onPick?: (id: string) => void;
  /** What the map is, for assistive tech, once it can be used. */
  label?: string;
  /** The word on a stop that sits beyond the frame. */
  later?: string;
  mode?: MapMode;
  /** The zoom buttons' names; without them the map has no buttons. */
  labels?: MapLabels;
}) {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const base = useRef<SVGSVGElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const target = frame ?? WORLD_FRAME;
  const framed = !!frame;
  const paper = mode === "paper";
  const bounds = frame ? worldFor(frame) : WORLD_FRAME.box;
  const aspect = target.box[2] / target.box[3];
  const minW = target.box[2] / MAX_ZOOM;
  const maxW = bounds[2];

  // The camera on screen (a ref, written every frame), the one React last heard of, and the box the drawing was last painted for.
  const [box, setBox] = useState<Box>(() => (frame ? worldFor(frame) : WORLD_FRAME.box));
  const cam = useRef<Box>(box);
  const painted = useRef<Box>(grown(box));
  const widthRef = useRef(640);
  const [width, setWidth] = useState(640);
  const tween = useRef<gsap.core.Tween | null>(null);

  /** Where a map point sits over the view, in pixels of the map's measured width (its height is that over the frame's aspect). */
  const haloAt = (x: number, y: number, b: Box, w: number) => `translate(${(((x - b[0]) / b[2]) * w).toFixed(2)}px, ${(((y - b[1]) / b[3]) * (w / aspect)).toFixed(2)}px)`;

  /** Keeps a box inside the world and between the zoom limits, at the frame's shape. */
  const fit = (b: Box): Box => {
    const w = Math.min(maxW, Math.max(minW, b[2]));
    const h = w / aspect;
    const x = Math.min(Math.max(b[0], bounds[0]), bounds[0] + bounds[2] - w);
    const y = Math.min(Math.max(b[1], bounds[1]), bounds[1] + bounds[3] - h);
    return [x, y, w, h];
  };

  /** Paints the drawing for a camera (the one heavy paint) and squares its layers to that zoom. */
  const paint = (b: Box) => {
    const el = base.current;
    if (!el) return;
    const g = grown(b);
    painted.current = g;
    if (el.getAttribute("viewBox") !== fmt(g)) el.setAttribute("viewBox", fmt(g));
    el.style.transform = "";
    const u = b[2] / widthRef.current;
    const z = target.box[2] / b[2];
    el.querySelectorAll<SVGElement>("[data-fit]").forEach((n) => {
      if (n.dataset.fit === "dash") n.setAttribute("stroke-dasharray", (n.dataset.dash as string).split(" ").map((d) => (Number(d) * u).toFixed(2)).join(" "));
      else if (n.dataset.fit === "layer") n.setAttribute("opacity", layerOpacity(z).toFixed(3));
    });
  };

  /** Writes a camera to the DOM: the viewBox, everything sized in pixels, the drawing slid under it. No React. */
  const apply = (b: Box) => {
    cam.current = b;
    const el = svg.current;
    if (!el) return;
    el.setAttribute("viewBox", fmt(b));
    if (!framed) return;
    const u = b[2] / widthRef.current;
    const z = target.box[2] / b[2];
    el.querySelectorAll<SVGElement>("[data-fit]").forEach((n) => {
      switch (n.dataset.fit) {
        case "pin":
          n.setAttribute("transform", `translate(${n.dataset.x} ${n.dataset.y}) scale(${u.toFixed(4)})`);
          break;
        case "dash":
          n.setAttribute("stroke-dasharray", (n.dataset.dash as string).split(" ").map((d) => (Number(d) * u).toFixed(2)).join(" "));
          break;
        case "label":
          n.setAttribute("opacity", labelOpacity(z).toFixed(3));
          break;
      }
    });
    // The drawing: slide and scale what was painted, or paint again once that would show.
    const p = painted.current;
    const s = p[2] / (b[2] * MARGIN);
    if (s > SHARP || !within(p, b)) paint(b);
    else if (base.current) {
      // Where the painted box's corner lands, as a share of the view, in the drawing's own terms (it sits MARGIN times the view wide, a quarter of it off to the left and top).
      const k = 100 / MARGIN;
      const tx = ((MARGIN - 1) / 2) * k + ((p[0] - b[0]) / b[2]) * k;
      const ty = ((MARGIN - 1) / 2) * k + ((p[1] - b[1]) / b[3]) * k;
      base.current.style.transform = `translate(${tx.toFixed(3)}%, ${ty.toFixed(3)}%) scale(${s.toFixed(4)})`;
    }
    // The picked pin's halo, an HTML element so its pulse never repaints the map.
    const h = halo.current;
    if (h) h.style.transform = haloAt(Number(h.dataset.x), Number(h.dataset.y), b, widthRef.current);
  };
  const commit = () => setBox([...cam.current] as Box);

  /** Flies the camera somewhere; instantly when motion is reduced. */
  const fly = (to: Box, duration: number, delay = 0) => {
    tween.current?.kill();
    const from = { x: cam.current[0], y: cam.current[1], w: cam.current[2] };
    const dest = fit(to);
    tween.current = gsap.to(from, {
      x: dest[0],
      y: dest[1],
      w: dest[2],
      duration: reduced() ? 0 : duration,
      delay: reduced() ? 0 : delay,
      ease: "power3.inOut",
      onUpdate: () => apply([from.x, from.y, from.w, from.w / aspect]),
      onComplete: commit,
    });
  };

  // Every React render draws the camera React knows; put the live one back before the browser paints.
  useLayoutEffect(() => {
    paint(cam.current);
    apply(cam.current);
  });

  // Fly from the whole world to the frame when the map opens (or the frame changes).
  const key = target.box.join(",");
  useEffect(() => {
    if (!frame) return;
    const world = worldFor(frame);
    paint(world);
    apply(world);
    fly(target.box, 1.6, 0.9);
    return () => {
      tween.current?.kill();
    };
    // Only a new frame restarts the flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, framed]);

  // Pins and type keep their size on screen whatever the zoom: sizes are given in pixels and turned into map units.
  useEffect(() => {
    const el = svg.current;
    if (!el || !frame) return;
    const ro = new ResizeObserver(([e]) => {
      widthRef.current = Math.max(1, e.contentRect.width);
      setWidth(widthRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame]);

  // Gestures: one finger drags, two pinch, the wheel zooms. All of it on the DOM; React hears at the end.
  const moved = useRef(false);
  useEffect(() => {
    const el = svg.current;
    if (!el || !frame) return;
    const pointers = new Map<number, [number, number]>();
    let last: { cx: number; cy: number; dist: number } | null = null;
    let settle = 0;
    const zoomAt = (factor: number, px: number, py: number) => {
      const b = cam.current;
      const r = el.getBoundingClientRect();
      const fx = (px - r.left) / r.width;
      const fy = (py - r.top) / r.height;
      const w = Math.min(maxW, Math.max(minW, b[2] / factor));
      const h = w / aspect;
      apply(fit([b[0] + fx * (b[2] - w), b[1] + fy * (b[3] - h), w, h]));
    };
    const gesture = () => {
      const pts = [...pointers.values()];
      if (pts.length >= 2) {
        const [a, c] = pts;
        return { cx: (a[0] + c[0]) / 2, cy: (a[1] + c[1]) / 2, dist: Math.hypot(a[0] - c[0], a[1] - c[1]) };
      }
      return { cx: pts[0][0], cy: pts[0][1], dist: 0 };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      tween.current?.kill();
      window.clearTimeout(settle);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      last = gesture();
      if (pointers.size === 1) moved.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !last) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      const g = gesture();
      const dx = g.cx - last.cx;
      const dy = g.cy - last.cy;
      if (!moved.current && Math.hypot(dx, dy) > TAP_SLOP) moved.current = true;
      if (!moved.current && pointers.size === 1) return;
      const b = cam.current;
      const u = b[2] / el.getBoundingClientRect().width;
      let next: Box = [b[0] - dx * u, b[1] - dy * u, b[2], b[3]];
      if (last.dist > 0 && g.dist > 0) {
        const factor = g.dist / last.dist;
        const r = el.getBoundingClientRect();
        const fx = (g.cx - r.left) / r.width;
        const fy = (g.cy - r.top) / r.height;
        const w = Math.min(maxW, Math.max(minW, next[2] / factor));
        const h = w / aspect;
        next = [next[0] + fx * (next[2] - w), next[1] + fy * (next[3] - h), w, h];
      }
      apply(fit(next));
      last = g;
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      last = pointers.size ? gesture() : null;
      if (pointers.size === 0 && moved.current) commit();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      tween.current?.kill();
      zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), e.clientX, e.clientY);
      window.clearTimeout(settle);
      settle = window.setTimeout(commit, 160);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      window.clearTimeout(settle);
    };
    // The limits only change with the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, framed]);

  /** Zooms about the frame of the stops while that is in view (so "+" from the world heads for the tour), else about the centre. */
  const zoomBy = (factor: number) => {
    const b = cam.current;
    const w = Math.min(maxW, Math.max(minW, b[2] / factor));
    const h = w / aspect;
    const anchor: [number, number] = [target.box[0] + target.box[2] / 2, target.box[1] + target.box[3] / 2];
    const [fx, fy] = inBox(b, anchor) ? [(anchor[0] - b[0]) / b[2], (anchor[1] - b[1]) / b[3]] : [0.5, 0.5];
    fly([b[0] + fx * (b[2] - w), b[1] + fy * (b[3] - h), w, h], 0.45);
  };

  // Pixel sizes become map units through u; off the frame (the deck's globe) the map draws at its own scale.
  const u = framed ? box[2] / width : 1.4;
  const placed = pins
    .map((pin) => {
      const at = locate(pin.city);
      return at ? { ...pin, xy: project(at[0], at[1]) } : null;
    })
    .filter((p): p is Pin & { xy: [number, number] } => !!p);
  const home = placed.find((p) => p.kind === "home");
  const picked = placed.find((p) => p.id === active && inBox(box, p.xy));
  const hit = new Set(target.layer === "states" ? placed.map((p) => stateAt(p.xy[0], p.xy[1])?.id) : []);
  const interactive = !!onPick;
  const pick = (id: string) => () => {
    if (!moved.current) onPick?.(id);
  };
  const onKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick?.(id);
    }
  };
  const nameOf = (p: Pin & { xy: [number, number] }) => {
    const st = target.layer === "states" ? stateAt(p.xy[0], p.xy[1]) : null;
    const name = st ? `${p.city}, ${st.abbr}` : p.city;
    return paper ? name : name.toUpperCase();
  };
  const z = target.box[2] / box[2];
  const dash = (a: number, b: number) => `${(a * u).toFixed(2)} ${(b * u).toFixed(2)}`;
  const fitPin = (x: number, y: number) => ({ "data-fit": "pin", "data-x": x.toFixed(2), "data-y": y.toFixed(2), transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${u.toFixed(4)})` });

  // Type: ink mode sets its labels in the stamp's sans, paper writes them in the italic, each on a patch of its own ground.
  const type = paper
    ? { fontFamily: "var(--font-quote)", fontStyle: "italic" as const, fontWeight: 400, paintOrder: "stroke" as const, stroke: "var(--wm-paper)", strokeWidth: 4, strokeLinejoin: "round" as const }
    : { fontFamily: "var(--font-sans)", fontWeight: 600, letterSpacing: 1.4, paintOrder: "stroke" as const, stroke: "#0a0a0a", strokeWidth: 3, strokeLinejoin: "round" as const };
  const inkText = paper ? "var(--wm-ink)" : "#e9e2d4";

  // The drawing: the land, its guide, and the lines of the region once the map has landed.
  const drawing = (
    <>
      {!paper && (
        <defs>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3d27a" />
            <stop offset="0.55" stopColor="#d4a84b" />
            <stop offset="1" stopColor="#8d6a25" />
          </linearGradient>
        </defs>
      )}
      {paper ? (
        <>
          {/* The pencil guide under the drawing, then the land in two strokes of the pen. Nothing here is dashed: dashing is paid for on every paint. */}
          <path d={GRATICULE} fill="none" stroke="var(--wm-ink)" strokeWidth="0.6" strokeOpacity="0.16" vectorEffect="non-scaling-stroke" />
          <path d={LAND_SKETCH[0]} fill="var(--wm-wash)" fillRule="evenodd" stroke="var(--wm-ink)" strokeWidth="1.15" strokeOpacity="0.92" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={LAND_SKETCH[1]} fill="none" stroke="var(--wm-ink)" strokeWidth="0.75" strokeOpacity="0.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </>
      ) : (
        <>
          {/* Gold land: the glow is one wide stroke under the fill, on the light sketch geometry, not a filter. */}
          <path d={LAND_SKETCH[0]} fill="none" stroke="#e0b353" strokeWidth="6" strokeOpacity="0.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={LAND} fill={`url(#${uid}-gold)`} stroke="#fff1c2" strokeWidth="0.7" strokeOpacity="0.5" opacity="0.96" />
        </>
      )}
      {framed && target.layer !== "world" && (
        <g data-fit="layer" opacity={layerOpacity(z)}>
          {paper ? (
            <path d={BORDERS} fill="none" stroke="var(--wm-ink)" strokeWidth="0.7" strokeOpacity="0.55" strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-fit="dash" data-dash="3 2.6" strokeDasharray={dash(3, 2.6)} />
          ) : (
            <path d={BORDERS} fill="none" stroke="#2a1d08" strokeWidth="0.7" strokeOpacity="0.7" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
          {target.layer === "states" && paper && (
            <g data-fit="dash" data-dash="2 2.4" strokeDasharray={dash(2, 2.4)}>
              {STATES.map((s) => {
                const on = hit.has(s.id);
                return (
                  <path
                    key={s.id}
                    d={s.d}
                    fill={on ? "var(--accent)" : "none"}
                    fillOpacity={on ? 0.09 : 0}
                    stroke="var(--wm-ink)"
                    strokeWidth={on ? 0.8 : 0.55}
                    strokeOpacity={on ? 0.7 : 0.42}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          )}
          {target.layer === "states" &&
            !paper &&
            STATES.map((s) => {
              const on = hit.has(s.id);
              return (
                <path
                  key={s.id}
                  d={s.d}
                  fill={on ? "#fff6d6" : "none"}
                  fillOpacity={on ? 0.3 : 0}
                  stroke={on ? "#fff6d6" : "#2a1d08"}
                  strokeWidth={on ? 1.1 : 0.55}
                  strokeOpacity={on ? 0.95 : 0.6}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </g>
      )}
    </>
  );

  return (
    <div className={`wm relative ${framed ? "overflow-hidden" : ""} ${className}`} data-mode={mode}>
      {/* The drawing, painted once per move with a margin around the view and slid underneath as a bitmap. */}
      {framed && (
        <svg
          ref={base}
          viewBox={fmt(grown(box))}
          aria-hidden
          className="wm-base pointer-events-none absolute"
          style={{ left: `${(-(MARGIN - 1) / 2) * 100}%`, top: `${(-(MARGIN - 1) / 2) * 100}%`, width: `${MARGIN * 100}%`, height: `${MARGIN * 100}%` }}
        >
          {drawing}
        </svg>
      )}

      <svg
        ref={svg}
        viewBox={fmt(box)}
        className="relative block w-full select-none"
        style={framed ? { aspectRatio: `${target.box[2]} / ${target.box[3]}`, touchAction: "none" } : undefined}
        aria-hidden={interactive ? undefined : true}
        role={interactive ? "group" : undefined}
        aria-label={interactive ? label : undefined}
      >
        {!framed && drawing}

        {/* From home to each stop: a pencil arc on paper, a dashed gold line in ink. */}
        {lines &&
          home &&
          placed
            .filter((p) => p.kind === "stop")
            .map((p) => {
              const [x1, y1] = home.xy;
              const [x2, y2] = p.xy;
              const mx = (x1 + x2) / 2;
              const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.28 - (framed ? 14 * u : 20);
              const on = active === p.id;
              return paper ? (
                <path
                  key={p.id}
                  d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
                  fill="none"
                  stroke={on ? "var(--accent)" : "var(--wm-pencil)"}
                  strokeWidth={on ? 1.5 : 1.2}
                  strokeOpacity={on ? 0.95 : 0.75}
                  strokeLinecap="round"
                  vectorEffect={framed ? "non-scaling-stroke" : undefined}
                  data-fit="dash"
                  data-dash="5 4"
                  strokeDasharray={dash(5, 4)}
                />
              ) : (
                <path
                  key={p.id}
                  d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={framed ? 1.4 : 1.6}
                  strokeOpacity={framed ? (on ? 0.9 : 0.55) : 0.85}
                  vectorEffect={framed ? "non-scaling-stroke" : undefined}
                  data-fit="dash"
                  data-dash="5 6"
                  strokeDasharray={dash(5, 6)}
                />
              );
            })}

        {placed.map((p) => {
          const [x, y] = p.xy;
          const homeish = p.kind === "home";
          const isActive = active === p.id;

          // A stop beyond the view waits at its edge. One beyond the frame itself says it comes later, and sits up in the
          // top band (or down in the bottom one), clear of the pins and their names; one merely panned out of view
          // sits where the way to it leaves the map.
          if (framed && !inBox(box, p.xy)) {
            const beyond = !inBox(target.box, p.xy);
            const [ex, ray] = edgePoint(box, p.xy, 26 * u);
            const north = p.xy[1] < box[1] + box[3] / 2;
            const ey = !beyond || Math.abs(ray - (box[1] + box[3] / 2)) > box[3] / 2 - 28 * u ? ray : north ? box[1] + 20 * u : box[1] + box[3] - 20 * u;
            const right = ex > box[0] + box[2] / 2;
            const word = paper ? p.city : p.city.toUpperCase();
            const then = later && beyond ? (paper ? later : later.toUpperCase()) : "";
            return (
              <g
                key={p.id}
                {...fitPin(ex, ey)}
                className={interactive ? "wm-in cursor-pointer" : "wm-in"}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={p.city}
                data-pin
                onClick={pick(p.id)}
                onKeyDown={onKey(p.id)}
              >
                <circle r="22" fill="transparent" />
                <circle r={paper ? 2.6 : 3.2} fill="var(--accent)" stroke={paper ? "var(--wm-ink)" : "none"} strokeWidth="0.9" />
                <text x={right ? -9 : 9} y={paper ? 4 : 3.6} textAnchor={right ? "end" : "start"} fontSize={paper ? 12.5 : 10} fill={isActive ? "var(--accent)" : inkText} style={type}>
                  {right ? `${then ? `${then} · ` : ""}${word} ›` : `‹ ${word}${then ? ` · ${then}` : ""}`}
                </text>
              </g>
            );
          }

          const labelRight = x < box[0] + box[2] * 0.72;
          return (
            <g
              key={p.id}
              {...fitPin(x, y)}
              className={interactive ? "cursor-pointer" : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={p.city}
              aria-pressed={interactive ? isActive : undefined}
              data-pin
              onClick={pick(p.id)}
              onKeyDown={onKey(p.id)}
            >
              {framed && <circle r="22" fill="transparent" />}
              {paper ? (
                homeish ? (
                  <>
                    {/* Home: a star in a circle, drawn once in ink. */}
                    <circle cx="0.6" cy="0.8" r="8.5" fill="var(--wm-ink)" opacity="0.1" />
                    <circle r="8" fill="var(--wm-paper)" stroke="var(--wm-ink)" strokeWidth="1.3" />
                    <path d={STAR} fill="var(--wm-ink)" />
                  </>
                ) : (
                  <>
                    {/* A push-pin: its shadow on the paper, the needle in the city, the head leaning off it. */}
                    <ellipse cx="4" cy="1.6" rx="6.5" ry="2.3" fill="var(--wm-ink)" opacity="0.12" />
                    <ellipse cx="3" cy="1.2" rx="3.6" ry="1.4" fill="var(--wm-ink)" opacity="0.2" />
                    <circle r="1.3" fill="var(--wm-ink)" />
                    <line x1="0" y1="0" x2="5" y2="-9.5" stroke="var(--wm-ink)" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="0.6" y1="-1.2" x2="4.8" y2="-9" stroke="#b9b1a4" strokeWidth="0.5" strokeLinecap="round" />
                    <circle cx="6.6" cy="-13" r="5.8" fill="var(--accent)" stroke="var(--wm-ink)" strokeWidth="1.15" />
                    <circle cx="4.7" cy="-15" r="1.7" fill="#fff" opacity="0.75" />
                  </>
                )
              ) : (
                <>
                  {/* A light: a soft glow in two circles and the dot. The picked one's ring pulses outside the map. */}
                  <circle r={homeish ? 9 : 7.5} fill="var(--accent)" opacity="0.22" />
                  <circle r={homeish ? 6 : 4.8} fill="var(--accent)" opacity="0.5" />
                  <circle r={homeish ? 4.2 : 3.2} fill={homeish || isActive ? "#fff6e0" : "var(--accent)"} />
                  {!framed && <circle r={homeish ? 11 : 9} fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.6" />}
                </>
              )}
              {framed && (
                <text
                  x={paper ? (labelRight ? 14 : -6) : labelRight ? 12 : -12}
                  y={paper ? (homeish ? 4.5 : -9) : 3.8}
                  textAnchor={labelRight ? "start" : "end"}
                  fontSize={paper ? 13 : 10.5}
                  fill={isActive ? "var(--accent)" : inkText}
                  data-fit="label"
                  opacity={labelOpacity(z)}
                  style={type}
                >
                  {nameOf(p)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* The picked pin breathes: a ring outside the SVG, so the pulse is composited and the map is never repainted for it. */}
      {framed && picked && (
        <div
          ref={halo}
          key={picked.id}
          aria-hidden
          className="wm-halo pointer-events-none absolute top-0 left-0"
          data-x={picked.xy[0].toFixed(2)}
          data-y={picked.xy[1].toFixed(2)}
          style={{ transform: haloAt(picked.xy[0], picked.xy[1], box, width) }}
        >
          <span className={`wm-pulse ${paper ? "wm-pulse--paper" : ""}`} />
        </div>
      )}

      {framed && labels && (
        <div className="wm-zoom absolute bottom-2 left-2 flex gap-1" role="group">
          <button type="button" className="wm-btn" onClick={() => zoomBy(1.8)} aria-label={labels.zoomIn} title={labels.zoomIn}>
            <span aria-hidden>+</span>
          </button>
          <button type="button" className="wm-btn" onClick={() => zoomBy(1 / 1.8)} aria-label={labels.zoomOut} title={labels.zoomOut}>
            <span aria-hidden>−</span>
          </button>
          <button type="button" className="wm-btn" onClick={() => fly(bounds, 0.7)} aria-label={labels.world} title={labels.world}>
            <span aria-hidden>
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
                <circle cx="10" cy="10" r="7.5" />
                <ellipse cx="10" cy="10" rx="3.2" ry="7.5" />
                <path d="M2.5 10h15M4 6.2h12M4 13.8h12" />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
