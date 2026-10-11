"use client";

import { useRef } from "react";

/** A trigger that opens its content as a modal sheet; the content's close button carries data-close. */
export function CardDialog({ trigger, children, label, className }: { trigger: React.ReactNode; children: React.ReactNode; label: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-label={label}
        onClick={(e) => {
          // A tap on the backdrop or on a close control shuts it.
          const el = e.target as HTMLElement;
          if (el === dialog.current || el.closest("[data-close]")) dialog.current?.close();
        }}
        className="m-auto max-h-[88dvh] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[20px] border border-gilt/50 bg-niche p-0 text-vellum backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {children}
      </dialog>
    </>
  );
}
