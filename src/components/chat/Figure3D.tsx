"use client";

import { useState } from "react";

import { PlacementPreview } from "@/app/studio/_legacy/PlacementPreview";

/** The 3D figure under the drawn plate, mounted only when asked for (it is heavy). */
export function Figure3D({ labels, ...props }: { labels: { show: string; hide: string }; body: "f" | "m"; heightCm: number; placement: string; widthCm: number | null; heightCmDesign: number | null; label: string; front: string; back: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="justify-self-start rounded-full border-[1.5px] border-[#2b2420] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em]">
        {open ? labels.hide : labels.show}
      </button>
      {open && <PlacementPreview {...props} />}
    </div>
  );
}
