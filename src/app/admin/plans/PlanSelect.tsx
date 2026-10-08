"use client";

import { useState, useTransition } from "react";

import { setPlan } from "../actions";

/** One select per studio; saves on change and says so beside it. */
export function PlanSelect({ studioId, plan, tiers, label, saved, error }: { studioId: string; plan: string; tiers: [string, string][]; label: string; saved: string; error: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const known = tiers.some(([v]) => v === plan);
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label={label}
        className="input min-h-9 w-auto py-1 text-[0.9rem]"
        defaultValue={plan}
        aria-busy={pending}
        onChange={(e) =>
          start(async () => {
            const r = await setPlan(studioId, e.target.value);
            setNote(r.ok ? saved : error);
          })
        }
      >
        {!known && <option value={plan}>{plan}</option>}
        {tiers.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <span role="status" className="min-w-[4ch] text-[0.8rem] text-verdigris">
        {note && !pending ? note : ""}
      </span>
    </span>
  );
}
