"use client";

import gsap from "gsap";
import { useEffect, useId, useRef, useState } from "react";

import { locate } from "./cities";
import { edgePoint, inBox, project, stateAt, WORLD_FRAME, type Box, type Frame } from "./frame";
import { BORDERS, STATES } from "./regions";
import { LAND, WORLD_H, WORLD_W } from "./world";

export interface Pin {
  /** The stop's id; what `onPick` gets back. */
  id: string;
  city: string;
  country: string;
  kind: "home" | "stop";
  /** First day of the stop, so an off-map stop can say when. */
  on: string | null;
}

/** The world box stretched to the frame's shape, so the zoom starts from the whole world and never letterboxes. */
function worldFor(frame: Frame): Box {
  const aspect = frame.box[2] / frame.box[3];
  const h = WORLD_W / aspect;
  return h >= WORLD_H ? [0, (WORLD_H - h) / 2, WORLD_W, h] : [(WORLD_W - WORLD_H * aspect) / 2, 0, WORLD_H * aspect, WORLD_H];
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The world in gold: every continent, the artist's home and the cities on the
 * tour, with flight lines from home to each stop. Given a `frame`, it opens on
 * the whole world and flies in to that region, draws its states or borders, and
 * names each stop; stops beyond the frame wait at its edge.
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
}) {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const target = frame ?? WORLD_FRAME;
  const [box, setBox] = useState<Box>(() => (frame ? worldFor(frame) : WORLD_FRAME.box));
  const [zoom, setZoom] = useState(frame ? 0 : 1);
  const [width, setWidth] = useState(640);

  // Fly from the whole world to the frame when the map opens (or the frame changes).
  const key = target.box.join(",");
  useEffect(() => {
    if (!frame) return;
    const from = { x: box[0], y: box[1], w: box[2], h: box[3], z: zoom };
    const to = { x: target.box[0], y: target.box[1], w: target.box[2], h: target.box[3], z: 1 };
    const tween = gsap.to(from, {
      ...to,
      duration: reduced() ? 0 : 1.5,
      delay: reduced() ? 0 : 0.45,
      ease: "power3.inOut",
      onUpdate: () => {
        setBox([from.x, from.y, from.w, from.h]);
        setZoom(from.z);
      },
    });
    return () => {
      tween.kill();
    };
    // Only a new frame restarts the flight; the box it starts from is whatever is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, frame ? 1 : 0]);

  // Pins and type keep their size on screen whatever the zoom: sizes are given in pixels and turned into map units.
  useEffect(() => {
    const el = svg.current;
    if (!el || !frame) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(1, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame]);

  const framed = !!frame;
  const u = (px: number) => (framed ? (px * box[2]) / width : px);
  const placed = pins
    .map((pin) => {
      const at = locate(pin.city);
      return at ? { ...pin, xy: project(at[0], at[1]) } : null;
    })
    .filter((p): p is Pin & { xy: [number, number] } => !!p);
  const home = placed.find((p) => p.kind === "home");
  const hit = new Set(target.layer === "states" ? placed.map((p) => stateAt(p.xy[0], p.xy[1])?.id) : []);
  const interactive = !!onPick;
  const pick = (id: string) => () => onPick?.(id);
  const onKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick?.(id);
    }
  };
  const nameOf = (p: Pin & { xy: [number, number] }) => {
    const st = target.layer === "states" ? stateAt(p.xy[0], p.xy[1]) : null;
    return (st ? `${p.city}, ${st.abbr}` : p.city).toUpperCase();
  };
  const glow = framed ? Math.max(1.2, (6 * target.box[2]) / WORLD_W) : 6;
  const type = { fontFamily: "var(--font-sans)", fontWeight: 600, letterSpacing: u(1.4), paintOrder: "stroke" as const, stroke: "#0a0a0a", strokeWidth: u(3), strokeLinejoin: "round" as const };

  return (
    <svg
      ref={svg}
      viewBox={box.map((n) => n.toFixed(2)).join(" ")}
      className={className}
      style={framed ? { aspectRatio: `${target.box[2]} / ${target.box[3]}` } : undefined}
      aria-hidden={interactive ? undefined : true}
      role={interactive ? "group" : undefined}
      aria-label={interactive ? label : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset="0.55" stopColor="#d4a84b" />
          <stop offset="1" stopColor="#8d6a25" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={glow} result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0.2  0 1 0 0 0.1  0 0 1 0 -0.2  0 0 0 0.9 0" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={glow / 2} />
        </filter>
      </defs>
      <path d={LAND} fill={`url(#${uid}-gold)`} filter={`url(#${uid}-glow)`} opacity="0.96" />
      <path d={LAND} fill="none" stroke="#fff1c2" strokeWidth={framed ? 0.8 * zoom + 0.2 : 0.8} vectorEffect={framed ? "non-scaling-stroke" : undefined} opacity="0.5" />

      {/* The engraved lines of the region: borders, and the states when the tour is in the US. */}
      {framed && target.layer !== "world" && (
        <g opacity={zoom * 0.9} style={{ transition: "opacity 200ms" }}>
          <path d={BORDERS} fill="none" stroke="#2a1d08" strokeWidth="0.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity="0.7" />
          {target.layer === "states" &&
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
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              );
            })}
        </g>
      )}

      {lines &&
        home &&
        placed
          .filter((p) => p.kind === "stop")
          .map((p) => {
            const [x1, y1] = home.xy;
            const [x2, y2] = p.xy;
            const mx = (x1 + x2) / 2;
            const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.28 - (framed ? u(14) : 20);
            return (
              <path
                key={p.id}
                d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={framed ? 1.4 : 1.6}
                vectorEffect={framed ? "non-scaling-stroke" : undefined}
                strokeDasharray={framed ? `${u(5)} ${u(6)}` : "6 7"}
                className="p-dash"
                opacity={framed ? 0.55 + 0.3 * (active === p.id ? 1 : 0) : 0.85}
              />
            );
          })}

      {placed.map((p, i) => {
        const [x, y] = p.xy;
        const homeish = p.kind === "home";
        const isActive = active === p.id;

        // A stop beyond the frame waits at its edge, pointing the way.
        if (framed && zoom > 0.5 && !inBox(target.box, p.xy)) {
          // On the side it lies, but up in the top band (or down in the bottom one), clear of the pins and their names.
          const [ex, ray] = edgePoint(target.box, p.xy, u(26));
          const north = p.xy[1] < target.box[1] + target.box[3] / 2;
          const ey = Math.abs(ray - (target.box[1] + target.box[3] / 2)) > target.box[3] / 2 - u(28) ? ray : north ? target.box[1] + u(20) : target.box[1] + target.box[3] - u(20);
          const right = ex > target.box[0] + target.box[2] / 2;
          return (
            <g
              key={p.id}
              className={interactive ? "cursor-pointer" : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={p.city}
              onClick={pick(p.id)}
              onKeyDown={onKey(p.id)}
              opacity={(zoom - 0.5) * 2}
            >
              <circle cx={ex} cy={ey} r={u(3.2)} fill="var(--accent)" />
              <text x={ex + (right ? -u(9) : u(9))} y={ey + u(3.6)} textAnchor={right ? "end" : "start"} fontSize={u(10)} fill={isActive ? "var(--accent)" : "#e9e2d4"} style={type}>
                {right ? `${later ? `${later.toUpperCase()} · ` : ""}${p.city.toUpperCase()} ›` : `‹ ${p.city.toUpperCase()}${later ? ` · ${later.toUpperCase()}` : ""}`}
              </text>
            </g>
          );
        }

        const r = framed ? { ring: u(homeish ? 11 : 9), glow: u(homeish ? 7 : 5.5), dot: u(homeish ? 4.2 : 3.2), hit: u(16) } : { ring: homeish ? 16 : 12, glow: homeish ? 9 : 6, dot: homeish ? 5 : 3.5, hit: 0 };
        const labelRight = x < target.box[0] + target.box[2] * 0.72;
        return (
          <g
            key={p.id}
            className={interactive ? "cursor-pointer" : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={p.city}
            aria-pressed={interactive ? isActive : undefined}
            onClick={pick(p.id)}
            onKeyDown={onKey(p.id)}
          >
            <circle cx={x} cy={y} r={r.ring} fill="none" stroke="var(--accent)" strokeWidth={framed ? 1.6 : 2} vectorEffect={framed ? "non-scaling-stroke" : undefined} className="p-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 0.5}s` }} />
            <circle cx={x} cy={y} r={r.glow} fill="var(--accent)" filter={`url(#${uid}-soft)`} opacity="0.9" />
            <circle cx={x} cy={y} r={r.dot} fill={homeish || isActive ? "#fff6e0" : "var(--accent)"} />
            {isActive && framed && <circle cx={x} cy={y} r={r.ring * 0.8} fill="none" stroke="#fff6e0" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
            {framed && r.hit > 0 && <circle cx={x} cy={y} r={r.hit} fill="transparent" />}
            {framed && (
              <text
                x={labelRight ? x + u(12) : x - u(12)}
                y={y + u(3.8)}
                textAnchor={labelRight ? "start" : "end"}
                fontSize={u(10.5)}
                fill={isActive ? "var(--accent)" : "#e9e2d4"}
                opacity={zoom}
                style={type}
              >
                {nameOf(p)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
