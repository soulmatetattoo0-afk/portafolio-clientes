"use client";

import { useState } from "react";

import { Mannequin } from "@/components/Mannequin";
import { PLACEMENTS, type BodyType } from "@/mannequin/catalog";

/** One figure in the wizard's own frame (46svh on a phone), with every placement a tap away. */
export function Bench() {
  const [body, setBody] = useState<BodyType>("m");
  const [placement, setPlacement] = useState<string | null>(null);
  return (
    <div className="poster min-h-dvh bg-soot px-4 pt-3 text-bone" style={{ ["--accent" as string]: "#c8231e" }}>
      <div id="stage" className="relative h-[46svh] min-h-[300px] overflow-hidden rounded-[18px] border border-line [background:radial-gradient(ellipse_60%_50%_at_50%_28%,#3d3e43,transparent_72%),radial-gradient(ellipse_70%_22%_at_50%_100%,rgb(0_0_0/0.65),transparent_70%),#1c1d20]">
        <Mannequin className="absolute inset-0" body={body} heightCm={body === "m" ? 178 : 167} mode="zone" placement={placement} onZoneTap={setPlacement} label="bench" />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-3 text-[0.7rem]">
        <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => setBody(body === "m" ? "f" : "m")}>
          body: {body}
        </button>
        <button type="button" className="rounded-full border border-line px-2 py-1" onClick={() => setPlacement(null)}>
          rest
        </button>
        {PLACEMENTS.map((p) => (
          <button key={p.slug} type="button" data-slug={p.slug} aria-pressed={placement === p.slug} className="rounded-full border border-line px-2 py-1 aria-pressed:bg-accent" onClick={() => setPlacement(p.slug)}>
            {p.slug}
          </button>
        ))}
      </div>
    </div>
  );
}
