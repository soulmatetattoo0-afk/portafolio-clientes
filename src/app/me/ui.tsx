import Link from "next/link";

import type { BriefStatus } from "@/lib/queries";

/** The page's name in the poster face and one line under it. */
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="p-display text-[clamp(2.6rem,12vw,4rem)] text-bone">{title}</h1>
      {lead && <p className="p-quote mt-2 max-w-[36ch] text-[1.3rem] text-bone/80">{lead}</p>}
      {children}
    </div>
  );
}

/** A section's name, stamped. */
export function SectionHead({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="p-stamp text-bone-dim">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** Where a brief stands. The two states that wait on the client glow in the accent. */
export function StatusPill({ status, label }: { status: BriefStatus; label: string }) {
  const hot = status === "quoted" || status === "needs_info";
  return (
    <span className={`p-stamp inline-flex min-h-7 items-center rounded-full border px-2.5 ${hot ? "border-accent text-accent" : "border-line-strong text-bone-dim"}`}>
      {label}
    </span>
  );
}

/** Nothing here yet, and the one thing to do about it. */
export function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line-strong px-4 py-5">
      <p className="text-bone-dim">{text}</p>
      {cta && (
        <Link href={cta.href} className="btn btn-secondary mt-4">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** The artist's own colour, as a dot beside their name. */
export function AccentDot({ accent }: { accent: string | null }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent ?? "var(--color-accent)" }} />;
}
