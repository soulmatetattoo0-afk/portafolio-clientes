"use client";

import { useEffect, useRef } from "react";

/** The slot the day's sheet prints out of: the first time the Sala opens each day, the paper slides out like a receipt. */
export function CallSheet({ day, children }: { day: string; children: React.ReactNode }) {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (localStorage.getItem("sala:day") === day) return;
      localStorage.setItem("sala:day", day);
      slot.current?.setAttribute("data-fresh", "true");
    } catch {
      /* no storage: no ceremony */
    }
  }, [day]);
  return (
    <div ref={slot} className="v2-slot">
      {children}
    </div>
  );
}
