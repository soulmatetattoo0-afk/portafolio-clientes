/** A photograph, or the striped plate with its title until there is one. */
export function Fig({ src, grey, duo, pos = "center", title, caption, sub, delay, className = "" }: { src?: string | null; grey?: boolean; duo?: boolean; pos?: "top" | "center"; title: string; caption?: string; sub?: string; delay?: string; className?: string }) {
  // Callers that place the figure themselves pass `absolute`; everyone else gets a positioned box for the caption.
  const box = /\babsolute\b/.test(className) ? "" : "relative";
  return (
    <figure data-img style={{ "--d": delay ?? "0ms" } as React.CSSProperties} className={`${box} overflow-hidden bg-[#161412] [container-type:inline-size] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} loading="lazy" className={`block h-full w-full object-cover ${pos === "top" ? "object-top" : "object-center"} ${grey ? "grayscale contrast-[1.08]" : ""}`} />
      ) : (
        <div className="grid h-full w-full place-items-center p-[6cqw]">
          <span aria-hidden className="mag-stripes absolute inset-0 opacity-25" />
          <span className="p-script relative text-center text-[clamp(1rem,9cqw,1.8rem)] leading-tight text-bone/70">{title}</span>
        </div>
      )}
      {duo && src && <div aria-hidden className="absolute inset-0 bg-accent opacity-85 mix-blend-multiply" />}
      {caption && (
        <figcaption className="absolute right-0 bottom-0 left-0 flex items-baseline justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-[4cqw] pt-[8cqw] pb-[3cqw] text-bone">
          <span className="p-stamp truncate">{caption}</span>
          {sub && <span className="p-stamp shrink-0 text-bone/60">{sub}</span>}
        </figcaption>
      )}
    </figure>
  );
}
