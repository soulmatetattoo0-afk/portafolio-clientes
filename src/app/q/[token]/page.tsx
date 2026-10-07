import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBanner, PublicBar } from "@/components/Chrome";
import { PolicyList } from "@/components/Policy";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { live } from "@/lib/env";
import { cmLabel, dateLong, money, moneyRange, placeLine, requestTime, sessionTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";
import { getQuoteByToken } from "@/lib/queries";

import { AwaitPayment, PayForm } from "./PayForm";

export const metadata = { title: "Quote", robots: { index: false, follow: false } };

export default async function QuotePage({ params, searchParams }: PageProps<"/q/[token]">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const quote = await getQuoteByToken(token);
  if (!quote) notFound();
  const { t, locale } = await getDict();
  const q = t.quote;
  if (quote.status === "sent") {
    const db = await getDb();
    await db.query(`update quotes set status = 'viewed' where id = $1 and status = 'sent'`, [quote.id]);
  }
  const now = requestTime();
  const expired = quote.status !== "paid" && new Date(quote.expires_at).getTime() < now;
  const placement = placementLabel(quote.placement, locale);
  const header = (
    <PublicBar>
      <Link href={`/${quote.artist_slug}`} className="t-inscription truncate py-2 text-[0.8rem] tracking-[0.24em] text-gilt">
        {quote.artist_name.toUpperCase()}
      </Link>
    </PublicBar>
  );

  if (quote.appointment) {
    const ap = quote.appointment;
    const { day, time } = sessionTime(ap.starts_at, ap.timezone, locale);
    const where = placeLine(ap.studio_name, ap.address, ap.city);
    return (
      <>
        <DemoBanner />
        {header}
        <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-10 px-4 pt-10 pb-20 sm:px-6 sm:pt-16">
          <div>
            <h1 className="t-display">{t.booked.title}</h1>
            <p className="mt-4 font-serif text-[1.4rem] text-vellum/90 italic">{fill(t.booked.lead, { date: dateLong(ap.starts_at, locale, ap.timezone) })}</p>
          </div>
          <dl className="divide-y divide-line border-y border-line">
            <Row label={t.booked.when}>
              <span className="t-num">
                {day}, {time}
              </span>
            </Row>
            {where && <Row label={t.booked.where}>{where}</Row>}
            <Row label={t.studio.brief.placement}>
              {placement}
              {quote.size_w_cm ? <span className="t-num text-ash">, {cmLabel(quote.size_w_cm, quote.size_h_cm)}</span> : null}
            </Row>
            <Row label={t.booked.deposit}>
              <span className="t-num">{money(quote.paid_cents ?? quote.deposit_cents, quote.currency, locale)}</span>
            </Row>
          </dl>
          <a href={`/q/${token}/ics`} className="btn btn-secondary w-fit">
            {t.booked.addToCalendar}
          </a>
          <section>
            <h2 className="t-heading mb-4">{t.booked.prepTitle}</h2>
            <ul className="grid gap-2">
              {t.booked.prep.map((p) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-gilt" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[0.9rem] text-ash">{t.booked.reminder}</p>
          </section>
        </main>
      </>
    );
  }

  const awaiting = sp.checkout === "success" && quote.status !== "paid";
  const closedMessage = quote.status === "withdrawn" ? fill(q.withdrawn, { artist: quote.artist_name }) : expired ? q.expired : null;
  const sessionsLabel = fill(quote.sessions === 1 ? q.sessions : q.sessionsPlural, { n: quote.sessions });

  return (
    <>
      <DemoBanner />
      {header}
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 pt-8 pb-20 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <section className="grid content-start gap-6">
          <div>
            <h1 className="t-title">{fill(q.title, { artist: quote.artist_name })}</h1>
            <p className="mt-3 font-serif text-[1.3rem] text-vellum/90 italic">
              {fill(q.forPiece, { placement: placement.toLowerCase() })}
              {quote.size_w_cm ? `, ${cmLabel(quote.size_w_cm, quote.size_h_cm)}` : ""}
            </p>
            <p className="mt-1 text-ash">
              {styleLabel(quote.style, locale)}, {colorLabel(quote.color_mode, locale).toLowerCase()}
            </p>
          </div>
          <dl className="grid gap-5 rounded-[var(--radius-lg)] border border-line bg-niche p-5">
            <div>
              <dt className="t-label">{q.price}</dt>
              <dd className="t-num mt-1 font-serif text-[2.2rem] leading-none">{moneyRange(quote.price_min_cents, quote.price_max_cents, quote.currency, locale)}</dd>
              <dd className="mt-2 text-[0.92rem] text-ash">
                {sessionsLabel}
                {quote.hours_per_session ? `, ${fill(q.hours, { h: quote.hours_per_session })}` : ""}
              </dd>
            </div>
            <div className="border-t border-line pt-4">
              <dt className="t-label">{q.deposit}</dt>
              <dd className="t-num mt-1 text-[1.5rem] font-medium">{money(quote.deposit_cents, quote.currency, locale)}</dd>
              <dd className="text-[0.9rem] text-ash">{quote.policy.applies_to_final_price ? q.depositNote : q.depositNoteFee}</dd>
            </div>
          </dl>
          {quote.message && (
            <figure>
              <figcaption className="t-label mb-2">{fill(q.message, { artist: quote.artist_name })}</figcaption>
              <blockquote className="border-l-2 border-gilt pl-4 font-serif text-[1.2rem] leading-relaxed whitespace-pre-line">{quote.message}</blockquote>
            </figure>
          )}
        </section>

        <section className="grid content-start gap-6">
          {awaiting ? (
            <p role="status" className="rounded-[var(--radius-md)] border border-line p-5 font-serif text-[1.3rem]">
              {t.booked.pending}
              <AwaitPayment />
            </p>
          ) : closedMessage ? (
            <p role="status" className="rounded-[var(--radius-md)] border border-ember/50 p-5 text-ember">
              {closedMessage}
            </p>
          ) : (
            <>
              {quote.slots.every((s) => s.status === "booked" || s.status === "released") ? (
                <p className="rounded-[var(--radius-md)] border border-line p-5 text-ash">{fill(q.noDates, { artist: quote.artist_name })}</p>
              ) : (
                <PayForm
                  token={token}
                  policyTitle={q.policy}
                  policy={<PolicyList policy={quote.policy} t={t} />}
                  slots={quote.slots
                    .filter((s) => s.status !== "released")
                    .map((s) => {
                      const { day, time } = sessionTime(s.starts_at, s.timezone, locale);
                      const available = s.status === "offered" || (s.status === "held" && s.hold_expires_at !== null && new Date(s.hold_expires_at).getTime() < now);
                      return { id: s.id, day, time, where: [s.studio_name, s.city].filter(Boolean).join(", "), available };
                    })}
                  labels={{
                    chooseDate: q.chooseDate,
                    chooseDateHint: q.chooseDateHint,
                    agree: q.agree,
                    pay: fill(live.payments ? q.pay : q.payDemo, { amount: money(quote.deposit_cents, quote.currency, locale) }),
                    redirecting: q.redirecting,
                    dateRequired: q.dateRequired,
                    agreeRequired: q.agreeRequired,
                    taken: q.slotTaken,
                  }}
                />
              )}
              <p className="text-[0.85rem] text-ash-dim">
                {fill(q.validUntil, { date: dateLong(quote.expires_at, locale) })} {fill(q.secure, { artist: quote.artist_name })}
              </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-4">
      <dt className="t-label pt-0.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
