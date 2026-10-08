"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** A small round button that runs one server action and refreshes the list it sits in. */
export function ToggleButton({ action, label, className = "" }: { action: () => Promise<unknown>; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm shrink-0 ${className}`}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await action();
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
