import Link from "next/link";
import { notFound } from "next/navigation";

import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { getMyBrief, requireClient } from "@/lib/client";
import { cmLabel, dateLong, money, moneyRange, requestTime } from "@/lib/format";
import { placementLabel } from "@/lib/messages";

import { AccentDot, SectionHead, StatusPill } from "../../ui";

export const metadata = { robots: { index: false } };

export default async function MyBriefPage({ params }: PageProps<"/me/briefs/[id]">) {
  const { id } = await params;
  const me = await requireClient(`/me/briefs/${id}`);
  const [{ t, locale }, brief] = await Promise.all([getDict(), getMyBrief(me.userId, id)]);
  if (!brief) notFound();
  const b = t.me.briefs;
  const d = b.detail;
  const w = t.brief;
  const placement = placementLabel(brief.placement, locale);
  const quote = brief.quote && brief.quoteDetail ? { ...brief.quote, ...brief.quoteDetail } : null;
  const quoteOpen = quote && (quote.status === "sent" || quote.status === "viewed") && new Date(quote.expires_at).getTime() > requestTime();
  const timing = brief.timing === "asap" ? w.timing.asap : brief.timing === "flexible" ? w.timing.flexible : (brief.preferred_dates ?? w.timing.specific);
  const refs = brief.files.filter((f) => f.kind === "reference");

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/me/briefs" className="p-stamp inline-flex items-center gap-2 py-2 text-bone-dim">
          <span aria-hidden className="text-[1.1rem] leading-none">←</span>
          {b.title}
        </Link>
        <h1 className="p-display mt-2 text-[clamp(2.4rem,11vw,3.6rem)] text-bone">{placement}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-bone-dim">
          <span className="flex items-center gap-2">
            <AccentDot accent={brief.artist_accent} />
            <Link href={`/${brief.artist_slug}`} className="text-bone underline-offset-4 hover:underline">
              {fill(d.to, { artist: brief.artist_name })}
            </Link>
          </span>
          <span>{brief.ref}</span>
          <StatusPill status={brief.status} label={b.status[brief.status]} />
        </p>
      </div>

      {quote && (
        <section aria-labelledby="quote" className="rounded-[18px] border border-line-strong bg-ink-2 p-5">
          <SectionHead id="quote">{d.quote}</SectionHead>
          <p className="p-display text-[2.4rem] text-bone">{moneyRange(quote.price_min_cents, quote.price_max_cents, quote.currency, locale)}</p>
          <p className="mt-1 text-bone-dim">
            {quote.sessions === 1 ? d.session : fill(d.sessions, { n: quote.sessions })}. {fill(t.me.overview.deposit, { amount: money(quote.deposit_cents, quote.currency, locale) })}.
          </p>
          {quote.message && <blockquote className="p-quote mt-4 border-l-2 border-accent pl-4 text-[1.25rem] leading-snug whitespace-pre-line text-bone/90">{quote.message}</blockquote>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {quote.paid ? (
              <>
                <span className="p-stamp text-accent">{d.paid}</span>
                <Link href={`/q/${quote.token}`} className="btn btn-secondary">
                  {t.me.appointments.openBooking}
                </Link>
              </>
            ) : (
              <Link href={`/q/${quote.token}`} className={quoteOpen ? "btn btn-primary" : "btn btn-secondary"}>
                {quoteOpen ? d.payDeposit : d.openQuote}
              </Link>
            )}
            {quoteOpen && <span className="text-[0.85rem] text-bone-dim">{fill(t.me.overview.validUntil, { date: dateLong(quote.expires_at, locale) })}</span>}
          </div>
        </section>
      )}

      <section aria-labelledby="spec">
        <SectionHead id="spec">{d.spec}</SectionHead>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Spec label={w.steps.placement}>
            {placement}
            {brief.size_w_cm ? <span className="block text-bone-dim">{cmLabel(brief.size_w_cm, brief.size_h_cm)}</span> : null}
          </Spec>
          <Spec label={w.steps.style}>
            {styleLabel(brief.style, locale)}
            <span className="block text-bone-dim">{colorLabel(brief.color_mode, locale)}</span>
          </Spec>
          <Spec label={d.when}>{timing}</Spec>
          <Spec label={d.budget}>{moneyRange(brief.budget_min_cents, brief.budget_max_cents, brief.currency, locale)}</Spec>
          <Spec label={d.city}>{brief.city ?? d.anyCity}</Spec>
          {brief.flash_title && <Spec label={d.design}>{brief.flash_title}</Spec>}
          {(brief.is_coverup || brief.is_first_tattoo) && (
            <Spec label={w.review.experience}>{[brief.is_coverup && w.review.coverup, brief.is_first_tattoo && w.review.firstTattoo].filter(Boolean).join(", ")}</Spec>
          )}
          <div className="col-span-2">
            <Spec label={d.idea}>
              <span className="whitespace-pre-line">{brief.description}</span>
            </Spec>
          </div>
          {brief.avoid && (
            <div className="col-span-2">
              <Spec label={d.notes}>{brief.avoid}</Spec>
            </div>
          )}
        </dl>
      </section>

      {refs.length > 0 && (
        <section aria-labelledby="refs">
          <SectionHead id="refs">{d.references}</SectionHead>
          <ul className="grid grid-cols-3 gap-2">
            {refs.map((f, i) => (
              <li key={f.id} className="aspect-square overflow-hidden rounded-[10px] border border-line bg-ink-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`${d.references} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="timeline">
        <SectionHead id="timeline">{d.timeline}</SectionHead>
        <ol className="grid gap-5 border-l border-line-strong pl-4">
          {brief.events.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className={`absolute top-[0.5em] -left-[1.3rem] h-2 w-2 rounded-full ${e.actor === "artist" ? "bg-accent" : "bg-line-strong"}`} />
              <p className="text-bone">
                {fill(d.events[e.kind as keyof typeof d.events] ?? e.kind, { artist: brief.artist_name })}
                <span className="ml-2 text-[0.85rem] text-bone-dim">{dateLong(e.created_at, locale)}</span>
              </p>
              {e.body && <p className="p-quote mt-1.5 max-w-[48ch] text-[1.2rem] leading-snug whitespace-pre-line text-bone/85">{e.body}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="p-stamp text-bone-dim">{label}</dt>
      <dd className="mt-1 break-words text-bone">{children}</dd>
    </div>
  );
}
