/**
 * One full-screen page of a magazine. Three papers: ink, bone, or the accent
 * itself. Sizes inside are container units, so a chapter reads the same on a
 * phone and on a monitor. `accent` recolours the page for one artist;
 * `still` shows it already revealed, for a page printed outside the reader.
 */
export function Ch({ tone, accent, still = false, children }: { tone: "ink" | "bone" | "accent"; accent?: string; still?: boolean; children: React.ReactNode }) {
  const look = tone === "ink" ? "bg-ink text-bone" : tone === "bone" ? "bg-bone text-ink" : "bg-accent text-ink";
  const style = accent ? ({ "--accent": accent } as React.CSSProperties) : undefined;
  return (
    <section style={style} className={`mag-ch ${still ? "is-in" : ""} relative h-full w-full overflow-hidden [container-type:size] ${look}`}>
      {tone === "ink" && <div className="p-halftone" aria-hidden />}
      {children}
    </section>
  );
}
