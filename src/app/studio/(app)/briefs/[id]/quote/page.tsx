import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { dict, fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { env, live } from "@/lib/env";
import { cmLabel, dateRange, moneyRange } from "@/lib/format";
import { feeBpsFor } from "@/lib/plan";
import { getArtistById, getBrief, listStops } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { sendQuote } from "../../../actions";
import { QuoteForm } from "./QuoteForm";

export default async function QuotePage({ params }: PageProps<"/studio/briefs/[id]/quote">) {
  const member = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ t, locale }, brief, stops, artist] = await Promise.all([getDict(), getBrief(member.studioId, id), listStops(member.artistId), getArtistById(member.artistId)]);
  if (!brief || !artist) notFound();
  if (brief.status === "booked" || brief.status === "declined") redirect(`/studio?brief=${id}`);
  const f = t.studio.quoteForm;
  const first = brief.client_name.split(" ")[0];
  const open = stops.filter((s) => s.status !== "done");
  const defaultStop = open.find((s) => s.id === brief.tour_stop_id)?.id ?? open.find((s) => s.is_home)?.id ?? open[0]?.id ?? "";
  const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency: artist.currency.toUpperCase() }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
  const suggested = brief.budget_min_cents ? Math.round(brief.budget_min_cents / 100) : null;
  const placement = PLACEMENT_BY_SLUG.get(brief.placement)?.label[locale];
  const feeBps = feeBpsFor(member.plan, env.platformFeeBps);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <Link href={`/studio?brief=${brief.id}`} className="btn btn-ghost btn-sm -ml-2 mb-4">
        {t.common.back}
      </Link>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <div>
          <h1 className="t-title">{fill(f.title, { name: brief.client_name })}</h1>
          <p className="mt-2 mb-8 text-ash">{f.lead}</p>
          {!live.payments || !artist.stripe_charges_enabled ? (
            <p className="mb-8 rounded-[var(--radius-md)] border border-ember/40 px-4 py-3 text-[0.92rem] text-ember">{f.stripeMissing}</p>
          ) : null}
          {feeBps > 0 ? (
            <p className="-mt-4 mb-8 text-[0.92rem] text-ash">
              {fill(t.studio.plan.feeNote, { fee: String(feeBps / 100) })}{" "}
              <Link href="/studio/settings#plan" className="link">
                {t.studio.plan.upgrade}
              </Link>
            </p>
          ) : null}
          {open.length === 0 ? (
            <p className="text-ash">{t.studio.cities.empty}</p>
          ) : (
            <QuoteForm
              action={sendQuote.bind(null, brief.id)}
              stops={open.map((s) => ({ id: s.id, label: [s.city, s.is_home ? null : dateRange(s.starts_on, s.ends_on, locale)].filter(Boolean).join(", ") }))}
              defaultStop={defaultStop}
              defaultMessage={fill(dict(brief.client_locale).templates.quote, { name: first })}
              suggestedPrice={suggested}
              currencySymbol={symbol}
              cancelHref={`/studio?brief=${brief.id}`}
              minDate={new Date().toISOString().slice(0, 10)}
              labels={{
                price: f.price,
                priceFrom: f.priceFrom,
                priceTo: f.priceTo,
                priceToHint: f.priceToHint,
                sessions: f.sessions,
                hours: f.hours,
                deposit: f.deposit,
                depositHint: f.depositHint,
                dates: f.dates,
                datesHint: f.datesHint,
                date: f.date,
                start: f.start,
                addDate: f.addDate,
                removeDate: f.removeDate,
                stop: f.stop,
                message: f.message,
                expires: f.expires,
                days: f.days,
                send: f.send,
                sending: f.sending,
                cancel: t.common.cancel,
                optional: t.common.optional,
              }}
            />
          )}
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-8 grid gap-4 rounded-[var(--radius-lg)] border border-line bg-niche p-6">
            <p className="t-meta t-num">{brief.ref}</p>
            <p className="font-serif text-[1.5rem] leading-tight">
              {placement}
              {brief.size_w_cm ? <span className="t-num ml-2 font-sans text-[0.95rem] text-ash">{cmLabel(brief.size_w_cm, brief.size_h_cm)}</span> : null}
            </p>
            <p className="text-ash">
              {styleLabel(brief.style, locale)}, {colorLabel(brief.color_mode, locale).toLowerCase()}
            </p>
            <p className="max-h-60 overflow-auto font-serif text-[1.1rem] leading-relaxed whitespace-pre-line">{brief.description}</p>
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-[0.92rem]">
              <div>
                <dt className="t-label">{t.studio.brief.budget}</dt>
                <dd className="t-num">{moneyRange(brief.budget_min_cents, brief.budget_max_cents, brief.currency, locale)}</dd>
              </div>
              <div>
                <dt className="t-label">{t.studio.brief.timing}</dt>
                <dd>{brief.timing === "specific" && brief.preferred_dates ? brief.preferred_dates : t.brief.timing[brief.timing]}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
