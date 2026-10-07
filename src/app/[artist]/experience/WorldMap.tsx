"use client";

import { useId } from "react";

import { locate } from "./cities";
import { LAND, PROJ, WORLD_H, WORLD_W } from "./world";

export interface Pin {
  city: string;
  kind: "home" | "stop" | "demand";
  /** How many people asked, for demand pins. */
  weight?: number;
}

/** Natural Earth, the same projection the land path was drawn in. */
function project(lat: number, lon: number): [number, number] {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const p2 = p * p;
  const p4 = p2 * p2;
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [PROJ.tx + PROJ.k * x, PROJ.ty - PROJ.k * y];
}

/**
 * The world in gold: every continent, the artist's home, the cities on the
 * tour and the cities asking, with flight lines from home to each stop.
 */
export function WorldMap({ pins, className = "", lines = true }: { pins: Pin[]; className?: string; lines?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const placed = pins
    .map((pin) => {
      const at = locate(pin.city);
      return at ? { ...pin, xy: project(at[0], at[1]) } : null;
    })
    .filter((p): p is Pin & { xy: [number, number] } => !!p);
  const home = placed.find((p) => p.kind === "home");
  const maxW = Math.max(1, ...placed.filter((p) => p.kind === "demand").map((p) => p.weight ?? 1));

  return (
    <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset="0.55" stopColor="#d4a84b" />
          <stop offset="1" stopColor="#8d6a25" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0.2  0 1 0 0 0.1  0 0 1 0 -0.2  0 0 0 0.9 0" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path d={LAND} fill={`url(#${uid}-gold)`} filter={`url(#${uid}-glow)`} opacity="0.96" />
      <path d={LAND} fill="none" stroke="#fff1c2" strokeWidth="0.8" opacity="0.5" />

      {lines &&
        home &&
        placed
          .filter((p) => p.kind === "stop")
          .map((p) => {
            const [x1, y1] = home.xy;
            const [x2, y2] = p.xy;
            const mx = (x1 + x2) / 2;
            const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.28 - 20;
            return <path key={p.city} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="6 7" className="p-dash" opacity="0.85" />;
          })}

      {placed.map((p, i) => {
        const [x, y] = p.xy;
        if (p.kind === "demand") {
          const r = 3 + (4 * (p.weight ?? 1)) / maxW;
          return (
            <g key={`${p.city}-${i}`} style={{ animationDelay: `${(i * 0.37) % 2.6}s` }} className="p-twinkle-dot">
              <circle cx={x} cy={y} r={r * 2.2} fill="#ffd98a" opacity="0.35" filter={`url(#${uid}-soft)`} />
              <circle cx={x} cy={y} r={r} fill="#fff3cf" />
            </g>
          );
        }
        const homeish = p.kind === "home";
        return (
          <g key={`${p.city}-${i}`}>
            <circle cx={x} cy={y} r={homeish ? 16 : 12} fill="none" stroke="var(--accent)" strokeWidth="2" className="p-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 0.5}s` }} />
            <circle cx={x} cy={y} r={homeish ? 9 : 6} fill="var(--accent)" filter={`url(#${uid}-soft)`} opacity="0.9" />
            <circle cx={x} cy={y} r={homeish ? 5 : 3.5} fill={homeish ? "#fff6e0" : "var(--accent)"} />
          </g>
        );
      })}
    </svg>
  );
}
