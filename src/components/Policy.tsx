import { fill, type Dict } from "@/i18n";
import type { DepositPolicy } from "@/lib/queries";

export function policyLines(p: DepositPolicy, t: Dict) {
  const lines = [p.refundable ? fill(t.policy.refundable, { hours: p.reschedule_notice_hours }) : t.policy.nonRefundable];
  if (p.reschedules_allowed > 0) {
    const count = p.reschedules_allowed === 1 ? t.policy.once : fill(t.policy.times, { n: p.reschedules_allowed });
    lines.push(fill(t.policy.reschedule, { count, hours: p.reschedule_notice_hours }));
  } else {
    lines.push(t.policy.rescheduleNone);
  }
  lines.push(p.applies_to_final_price ? t.policy.appliesToFinal : t.policy.notApplied);
  return lines;
}

export function PolicyList({ policy, t }: { policy: DepositPolicy; t: Dict }) {
  return (
    <ul className="grid gap-2 text-[0.95rem] text-vellum/90">
      {policyLines(policy, t).map((line) => (
        <li key={line} className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-gilt" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
