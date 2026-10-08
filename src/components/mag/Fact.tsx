/** One line of a spec list: the label dimmed, the value in the page's ink. */
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
      <dt className="opacity-55">{label}</dt>
      <dd className="text-current">{children}</dd>
    </div>
  );
}
