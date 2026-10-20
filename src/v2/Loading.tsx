import { VantaMark } from "@/components/brand/VantaLogo";

/**
 * What a tap shows at once while the next screen comes from the server: the
 * page's shape in soft blocks and the house mark breathing, the bar's room
 * kept so nothing jumps. Next prefetches this with every link, so it appears
 * the instant a finger lands.
 */
export function Loading({ kind = "page" }: { kind?: "page" | "list" | "chat" }) {
  return (
    <div className="poster flex min-h-dvh flex-col" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <span className="h-9 w-9 animate-pulse rounded-full bg-bone/10" />
        <span className="h-6 w-40 animate-pulse rounded-full bg-bone/10" />
      </div>
      <div className="grid flex-1 content-start gap-3 px-3 pb-[var(--v2-bar)]">
        {kind === "list" &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-bone/10" />
              <span className="grid flex-1 gap-2">
                <span className="h-4 w-1/2 animate-pulse rounded-full bg-bone/10" />
                <span className="h-3 w-3/4 animate-pulse rounded-full bg-bone/[0.06]" />
              </span>
            </div>
          ))}
        {kind === "chat" && (
          <>
            <div className="h-56 w-[86%] animate-pulse rounded-[18px] bg-bone/10" />
            <div className="ml-auto h-16 w-[70%] animate-pulse rounded-[18px] bg-bone/[0.06]" />
            <div className="h-16 w-[60%] animate-pulse rounded-[18px] bg-bone/[0.06]" />
          </>
        )}
        {kind === "page" && (
          <>
            <div className="h-[38vh] animate-pulse rounded-[22px] bg-bone/10" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-[22vh] animate-pulse rounded-[22px] bg-bone/[0.07]" />
              <div className="h-[22vh] animate-pulse rounded-[22px] bg-bone/[0.07]" />
            </div>
            <div className="h-[11vh] animate-pulse rounded-[22px] bg-bone/[0.05]" />
          </>
        )}
      </div>
      <div className="pointer-events-none fixed inset-0 grid place-items-center" aria-hidden>
        <VantaMark className="h-10 w-auto animate-pulse text-bone/40" />
      </div>
    </div>
  );
}
