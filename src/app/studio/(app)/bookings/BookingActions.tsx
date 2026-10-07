"use client";

import { useTransition } from "react";

import { setAppointmentStatus } from "../actions";

export function BookingActions({ id, past, labels }: { id: string; past: boolean; labels: { done: string; noShow: string; cancel: string } }) {
  const [pending, start] = useTransition();
  const act = (status: "completed" | "no_show" | "cancelled") => start(() => setAppointmentStatus(id, status));
  return (
    <div className="flex flex-wrap gap-1" aria-busy={pending}>
      {past ? (
        <>
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => act("completed")}>
            {labels.done}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act("no_show")}>
            {labels.noShow}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act("cancelled")}>
          {labels.cancel}
        </button>
      )}
    </div>
  );
}
