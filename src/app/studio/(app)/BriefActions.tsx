"use client";

import { useActionState, useState, useTransition } from "react";

import { askDetails, declineBrief, setBriefStatus, type FormState } from "./actions";
import { useSubmit } from "@/components/useSubmit";

interface Labels {
  quote: string;
  ask: string;
  decline: string;
  archive: string;
  reopen: string;
  askTitle: string;
  askLead: string;
  askSend: string;
  declineTitle: string;
  declineLead: string;
  declineConfirm: string;
  message: string;
  cancel: string;
}

export function BriefActions({ briefId, status, labels, templates }: { briefId: string; status: string; labels: Labels; templates: { ask: string; decline: string } }) {
  const [open, setOpen] = useState<"ask" | "decline" | null>(null);
  const [pending, start] = useTransition();
  const closed = status === "declined" || status === "archived";
  const booked = status === "booked";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {!closed && !booked && (
          <button type="button" className="btn btn-ghost" aria-expanded={open === "decline"} onClick={() => setOpen(open === "decline" ? null : "decline")}>
            {labels.decline}
          </button>
        )}
        {!booked && (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => start(() => setBriefStatus(briefId, closed ? "new" : "archived"))}>
            {closed ? labels.reopen : labels.archive}
          </button>
        )}
      </div>
      {open === "ask" && (
        <MessageForm
          key="ask"
          action={askDetails.bind(null, briefId)}
          title={labels.askTitle}
          lead={labels.askLead}
          submit={labels.askSend}
          tone="secondary"
          initial={templates.ask}
          labels={labels}
          onDone={() => undefined}
        />
      )}
      {open === "decline" && (
        <MessageForm
          key="decline"
          action={declineBrief.bind(null, briefId)}
          title={labels.declineTitle}
          lead={labels.declineLead}
          submit={labels.declineConfirm}
          tone="danger"
          initial={templates.decline}
          labels={labels}
          onDone={() => undefined}
        />
      )}
    </div>
  );
}

function MessageForm(props: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  title: string;
  lead: string;
  submit: string;
  tone: "secondary" | "danger";
  initial: string;
  labels: Labels;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(props.action, { ok: false, message: null });
  const onSubmit = useSubmit(action);
  if (state.ok) {
    return (
      <p role="status" className="rounded-[var(--radius-md)] border border-line px-4 py-3 text-verdigris">
        {state.message}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-niche p-4">
      <div>
        <p className="font-semibold">{props.title}</p>
        <p className="mt-1 text-[0.9rem] text-ash">{props.lead}</p>
      </div>
      <label className="sr-only" htmlFor={`msg-${props.tone}`}>
        {props.labels.message}
      </label>
      <textarea id={`msg-${props.tone}`} name="message" className="input min-h-32" defaultValue={props.initial} required maxLength={3000} />
      {state.message && (
        <p role="alert" className="text-[0.88rem] text-oxblood">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={`btn ${props.tone === "danger" ? "btn-danger" : "btn-primary"}`} disabled={pending}>
          {props.submit}
        </button>
      </div>
    </form>
  );
}
