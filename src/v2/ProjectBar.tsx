"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BodyChart, chartViews } from "@/components/chat/BodyChart";

export type BarTone = "new" | "info" | "amber" | "green" | "gold";

const DOT: Record<BarTone, string> = { new: "bg-accent", info: "bg-bone/50", amber: "bg-[#e8c46b]", green: "bg-[#8fb07a]", gold: "bg-[#f2d27a]" };
const TEXT: Record<BarTone, string> = { new: "text-bone", info: "text-bone/65", amber: "text-[#f2d27a]", green: "text-[#c3dcae]", gold: "text-[#f2d27a]" };

/**
 * The project, pinned under the name at the top of the chat as it scrolls: a
 * scrap of the letter with the area drawn, the project's title, and VANTA's
 * latest word on it (booking asked, confirmed, paid in full). A tap opens the
 * whole project.
 */
export function BarSummary({ title, status, tone, placement, body }: { title: string; status: string; tone: BarTone; placement: string; body: "f" | "m" }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className="grid h-11 w-8 shrink-0 place-items-center rounded-[3px] bg-[#f3ecdf] shadow-[0_6px_12px_-8px_rgb(0_0_0/0.9)]">
        <BodyChart placement={placement} body={body} views={[chartViews(placement)[0] ?? "front"]} className="w-[1.15rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9rem] font-semibold text-bone">{title}</span>
        <span className={`mt-0.5 flex items-center gap-1.5 text-[0.72rem] ${TEXT[tone]}`}>
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
          <span className="truncate">{status}</span>
        </span>
      </span>
    </span>
  );
}

/**
 * The red key next to the project: what comes next, one tap away. It can be
 * a link (book, pay), a step that opens its form under the letter (accept,
 * evaluate), or a one-tap action asked twice (collect, payment received).
 */
export function BarAction({ label, href, event, action, confirm }: { label: string; href?: string; event?: "accept" | "confirm"; action?: () => Promise<{ error?: string; url?: string } | void>; confirm?: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = "flex h-10 max-w-[48%] shrink-0 items-center rounded-full bg-accent px-3.5 text-[0.78rem] leading-tight font-semibold text-bone shadow-[0_8px_18px_-10px_rgb(0_0_0/0.9)] active:scale-95 disabled:opacity-60";
  if (href)
    return (
      <a href={href} className={cls}>
        <span className="line-clamp-2">{label}</span>
      </a>
    );
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        disabled={pending}
        className={`${cls} ${armed ? "ring-2 ring-[#f2d27a]" : ""}`}
        onClick={() => {
          if (event) {
            window.dispatchEvent(new CustomEvent("vanta:quote", { detail: event }));
            return;
          }
          if (!action) return;
          if (confirm && !armed) {
            setArmed(true);
            setTimeout(() => setArmed(false), 6000);
            return;
          }
          setArmed(false);
          start(async () => {
            setError(null);
            const r = await action();
            if (r && "error" in r && r.error) setError(r.error);
            else if (r && "url" in r && r.url) {
              if (r.url.startsWith("http")) window.location.assign(r.url);
              else router.push(r.url);
            } else router.refresh();
          });
        }}
      >
        <span className="line-clamp-2">{armed && confirm ? confirm : label}</span>
      </button>
      {error && <span role="alert" className="absolute top-full right-0 mt-1 w-52 rounded-[10px] bg-ink px-2 py-1 text-right text-[0.72rem] text-accent">{error}</span>}
    </span>
  );
}
