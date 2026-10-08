import Link from "next/link";

/** One quiet line where a Full-only control would be: what it is, and the way up. Works in server and client trees. */
export function PlanLock({ text, cta, className = "" }: { text: string; cta: string; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-ash ${className}`}>
      <span>{text}</span>
      <Link href="/studio/settings#plan" className="link text-gilt">
        {cta}
      </Link>
    </p>
  );
}
