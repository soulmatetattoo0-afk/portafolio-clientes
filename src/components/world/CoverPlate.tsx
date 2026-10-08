/**
 * The typeset cover an artist gets until there is a portrait: the initial
 * set huge, the name, a halftone. Reads the accent the card is wearing.
 */
/** The wrapper must be `[container-type:inline-size]` so the initial scales with it. */
export function CoverPlate({ name, compact = false }: { name: string; compact?: boolean }) {
  const initial = (name.trim()[0] ?? "V").toUpperCase();
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-ink-2 text-bone">
      <div className="p-halftone" />
      <span className={`p-display absolute -top-[0.04em] -right-[0.06em] leading-none text-accent ${compact ? "text-[105cqw]" : "text-[110cqw]"}`}>{initial}</span>
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}
