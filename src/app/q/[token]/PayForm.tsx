"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSubmit } from "@/components/useSubmit";

import { startDeposit, type PayState } from "./actions";

export interface SlotOption {
  id: string;
  day: string;
  time: string;
  where: string;
  available: boolean;
}

export function PayForm(props: {
  token: string;
  slots: SlotOption[];
  labels: { chooseDate: string; chooseDateHint: string; agree: string; pay: string; redirecting: string; dateRequired: string; agreeRequired: string; taken: string };
  policy: React.ReactNode;
  policyTitle: string;
}) {
  const [state, action, pending] = useActionState<PayState, FormData>(startDeposit.bind(null, props.token), { error: null });
  const [slot, setSlot] = useState<string | null>(props.slots.find((s) => s.available)?.id ?? null);
  const [agree, setAgree] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const submit = useSubmit(action);
  const l = props.labels;

  return (
    <form
      onSubmit={(e) => {
        if (!slot) {
          e.preventDefault();
          return setLocal(l.dateRequired);
        }
        if (!agree) {
          e.preventDefault();
          return setLocal(l.agreeRequired);
        }
        setLocal(null);
        submit(e);
      }}
      className="grid gap-8"
    >
      <fieldset className="grid gap-2">
        <legend className="t-heading mb-1">{l.chooseDate}</legend>
        <p className="mb-2 text-[0.9rem] text-ash">{l.chooseDateHint}</p>
        {props.slots.map((s) => (
          <label
            key={s.id}
            className={`flex items-center gap-4 rounded-[var(--radius-md)] border px-4 py-3.5 ${s.available ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${slot === s.id ? "border-gilt bg-niche" : "border-line-strong"}`}
          >
            <input type="radio" name="slot" value={s.id} disabled={!s.available} checked={slot === s.id} onChange={() => setSlot(s.id)} />
            <span className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
              <span className="font-serif text-[1.3rem] leading-tight">{s.day}</span>
              <span className="t-num text-[0.95rem]">{s.time}</span>
              <span className="text-[0.85rem] text-ash sm:col-span-2">{s.available ? s.where : l.taken}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <section className="grid gap-4">
        <h2 className="t-heading">{props.policyTitle}</h2>
        {props.policy}
        <label className="flex cursor-pointer items-start gap-3 py-1">
          <input type="checkbox" name="agree" className="mt-1 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{l.agree}</span>
        </label>
      </section>

      {(local || state.error) && (
        <p role="alert" className="text-oxblood">
          {local ?? state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-64" disabled={pending} aria-busy={pending}>
        {pending ? l.redirecting : l.pay}
      </button>
    </form>
  );
}

/** After Stripe returns, wait for the webhook to confirm the booking. */
export function AwaitPayment() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n > 20) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
