"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { BodyType } from "@/mannequin/catalog";
import type { DesignPlacement, MannequinEngine, ViewerMode } from "@/mannequin/engine";

export interface MannequinHandle {
  engine: MannequinEngine | null;
}

export interface MannequinProps {
  body: BodyType;
  heightCm: number;
  mode: ViewerMode;
  placement: string | null;
  design?: { widthCm: number; heightCm: number; rotationDeg: number } | null;
  /** Re-place a saved design (artist view of a brief). */
  savedPoint?: { point: [number, number, number]; normal: [number, number, number] } | null;
  onZoneTap?: (slug: string) => void;
  onPlace?: (p: DesignPlacement) => void;
  onUnsupported?: () => void;
  /** A still, framed on the placement: no orbit, no taps. Front/back stay available through the handle. */
  readOnly?: boolean;
  /** Tint every zone with its usual pain (while the client chooses an area). */
  painMap?: boolean;
  className?: string;
  label: string;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** React shell around the three.js engine. The engine is loaded only in the browser. */
export const Mannequin = forwardRef<MannequinHandle, MannequinProps>(function Mannequin(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MannequinEngine | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    get engine() {
      return engineRef.current;
    },
  }));

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) {
      latest.current.onUnsupported?.();
      return;
    }
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void import("@/mannequin/engine").then(({ MannequinEngine }) => {
      if (disposed || !host.current) return;
      // The patch outline takes the page's accent (the artist's colour on public pages).
      const accent = getComputedStyle(host.current).getPropertyValue("--accent").trim();
      engineRef.current = new MannequinEngine(host.current, {
        assetBase: "/mannequin",
        body: latest.current.body,
        heightCm: latest.current.heightCm,
        reducedMotion: reduced,
        accent: accent || undefined,
        onReady: () => setReady(true),
        onError: () => latest.current.onUnsupported?.(),
        onZoneTap: (slug) => {
          if (!latest.current.readOnly) latest.current.onZoneTap?.(slug);
        },
        onPlace: (p) => {
          if (!latest.current.readOnly) latest.current.onPlace?.(p);
        },
      });
    });
    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const { body, heightCm, mode, placement, design, savedPoint, readOnly = false, painMap = false } = props;
  useEffect(() => {
    if (ready) engineRef.current?.setPainMap(painMap);
  }, [ready, painMap]);
  // Apply only what changed since the last sync, in order, so a new tap never re-frames the camera.
  const applied = useRef<{ body?: BodyType; height?: number; mode?: ViewerMode; placement?: string | null; design?: string; readOnly?: boolean }>({});
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!ready) return;
    chain.current = chain.current.then(async () => {
      const e = engineRef.current;
      if (!e) return;
      const p = latest.current;
      const a = applied.current;
      if (a.body !== p.body) {
        await e.setBody(p.body);
        Object.assign(a, { body: p.body, height: undefined, placement: undefined, design: undefined });
      }
      if (a.height !== p.heightCm) {
        e.setHeight(p.heightCm);
        a.height = p.heightCm;
        a.design = undefined;
      }
      if (a.mode !== p.mode) {
        e.setMode(p.mode);
        a.mode = p.mode;
      }
      if (a.placement !== p.placement) {
        e.selectPlacement(p.placement, true);
        a.placement = p.placement;
        a.design = undefined;
      }
      const show = Boolean(p.placement && p.design && (p.mode === "place" || p.savedPoint));
      const key = show ? JSON.stringify([p.design, p.savedPoint]) : "none";
      if (a.design !== key) {
        if (!show || !p.design) e.clearDesign();
        else {
          e.setDesignSize(p.design.widthCm, p.design.heightCm, p.design.rotationDeg);
          if (p.savedPoint) e.placeAt(p.savedPoint.point, p.savedPoint.normal);
          else e.placeAtCenter();
        }
        a.design = key;
      }
      if (a.readOnly !== Boolean(p.readOnly)) {
        a.readOnly = Boolean(p.readOnly);
        // Becoming a still: let the host settle at its new size, then frame the placement again.
        if (a.readOnly && p.placement) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          engineRef.current?.focusPlacement(p.placement);
        }
      }
    });
  }, [ready, body, heightCm, mode, placement, design, savedPoint, readOnly]);

  return (
    <div
      ref={host}
      role="img"
      aria-label={props.label}
      className={`transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"} ${readOnly ? "pointer-events-none" : ""} ${props.className ?? "relative h-full w-full"}`}
    />
  );
});
