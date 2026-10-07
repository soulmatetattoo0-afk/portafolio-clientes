"use client";

import { useMemo, useRef } from "react";

import { Halo } from "@/app/HeroFigure";
import { Mannequin, type MannequinHandle } from "@/components/Mannequin";
import type { BodyType } from "@/mannequin/catalog";

/** Read-only figure showing exactly where and how big the client wants the piece. */
export function PlacementPreview(props: {
  body: BodyType;
  heightCm: number;
  placement: string;
  widthCm: number | null;
  heightCmDesign: number | null;
  point?: [number, number, number];
  normal?: [number, number, number];
  rotationDeg?: number;
  label: string;
  front: string;
  back: string;
}) {
  const viewer = useRef<MannequinHandle>(null);
  const design = useMemo(
    () => (props.widthCm && props.heightCmDesign ? { widthCm: props.widthCm, heightCm: props.heightCmDesign, rotationDeg: props.rotationDeg ?? 0 } : null),
    [props.widthCm, props.heightCmDesign, props.rotationDeg],
  );
  const saved = useMemo(() => (props.point && props.normal ? { point: props.point, normal: props.normal } : null), [props.point, props.normal]);
  return (
    <div className="relative h-[380px] overflow-hidden rounded-[var(--radius-lg)] border border-line [background:radial-gradient(ellipse_60%_50%_at_50%_28%,#3d3e43,transparent_72%),radial-gradient(ellipse_70%_22%_at_50%_100%,rgb(0_0_0/0.65),transparent_70%),#1c1d20] sm:h-[440px]">
      <Halo />
      <Mannequin
        ref={viewer}
        className="absolute inset-0"
        body={props.body}
        heightCm={props.heightCm}
        mode="view"
        placement={props.placement}
        design={saved ? design : null}
        savedPoint={saved}
        label={props.label}
      />
      <div className="absolute bottom-3 left-3 flex gap-1.5">
        <button type="button" className="btn btn-secondary btn-sm bg-soot/70 backdrop-blur" onClick={() => viewer.current?.engine?.rotateTo("front")}>
          {props.front}
        </button>
        <button type="button" className="btn btn-secondary btn-sm bg-soot/70 backdrop-blur" onClick={() => viewer.current?.engine?.rotateTo("back")}>
          {props.back}
        </button>
      </div>
    </div>
  );
}
