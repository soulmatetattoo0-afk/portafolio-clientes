"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { quickArtist } from "@/app/studio/_legacy/actions";
import { VantaMark } from "@/components/brand/VantaLogo";
import type { Dict } from "@/i18n";

/**
 * The care sheets written on the paper the client receives: the same letter
 * they get in the chat, with the words typed straight onto it. Before the
 * tattoo goes out when the booking is paid; after, when the rest is paid.
 */
export function CareRoom({ artist, precare, postcare, t }: { artist: string; precare: string; postcare: string; t: Dict }) {
  const r = t.v2.room.rooms;
  const router = useRouter();
  const [stage, setStage] = useState<"pre" | "post">("pre");
  const [text, setText] = useState({ pre: precare, post: postcare });
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await quickArtist({ precare: text.pre, postcare: text.post });
      if (!res?.error) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1800);
      }
    });
  return (
    <div className="grid gap-4">
      <div className="v2-seg" role="tablist">
        {(["pre", "post"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={stage === k} onClick={() => setStage(k)}>
            {k === "pre" ? t.care.preTitle : t.care.postTitle}
          </button>
        ))}
      </div>
      <figure className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[6px] bg-[#f1ebdd] px-6 pt-7 pb-6 text-[#2b2420] shadow-[0_24px_40px_-18px_rgb(0_0_0/0.8)]">
        <span className="p-grain" aria-hidden style={{ opacity: 0.35 }} />
        <span aria-hidden className="absolute inset-x-6 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
        <div className="relative">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60">{t.care.from.replace("{artist}", artist)}</p>
          <h2 className="mt-2 font-[family-name:var(--font-cinzel)] text-[1.55rem] leading-[1.05] font-bold uppercase">{stage === "pre" ? t.care.preTitle : t.care.postTitle}</h2>
          <span aria-hidden className="mt-3 block h-px w-12" style={{ background: "var(--accent)" }} />
          <textarea
            aria-label={stage === "pre" ? t.care.preTitle : t.care.postTitle}
            value={text[stage]}
            maxLength={4000}
            onChange={(e) => setText((p) => ({ ...p, [stage]: e.target.value }))}
            rows={11}
            className="mt-4 w-full resize-none bg-transparent font-[family-name:var(--font-cormorant)] text-[1.2rem] leading-[1.45] italic text-[#2b2420] outline-none placeholder:text-[#2b2420]/40 focus:bg-[#2b2420]/[0.04]"
          />
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[0.75rem] text-[#2b2420]/60">{stage === "pre" ? r.careWhenPre : r.careWhenPost}</span>
            <VantaMark className="h-7 w-auto text-[#2b2420]/70" />
          </div>
        </div>
      </figure>
      <p className="px-1 text-center text-[0.82rem] text-bone-dim">{r.careHint}</p>
      <button type="button" className="v2-btn justify-self-center" data-tone="accent" disabled={pending} onClick={save}>
        {saved ? t.v2.settings.saved : r.careSave}
      </button>
    </div>
  );
}
