import Link from "next/link";

import { dict, fill, type Dict, type Locale } from "@/i18n";
import { colorLabel, styleLabel } from "@/lib/catalog";
import { cmLabel, money, moneyRange, relativeTime } from "@/lib/format";
import type { ChatThread } from "@/lib/chat";
import type { BriefDetail } from "@/lib/queries";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

import { ArtistChat } from "./ArtistChat";
import { BriefActions } from "./BriefActions";
import { PlacementPreview } from "./PlacementPreview";

export const STATUS_TONE: Record<string, string> = {
  new: "text-gilt",
  needs_info: "text-ember",
  quoted: "text-vellum",
  booked: "text-verdigris",
  declined: "text-ash-dim",
  archived: "text-ash-dim",
};

export function statusLabel(status: string, t: Dict) {
  const tabs = t.studio.requests.tabs;
  if (status === "declined") return t.studio.brief.events.declined;
  if (status === "archived") return t.studio.brief.archive;
  return tabs[status as keyof typeof tabs] ?? status;
}

export function BriefView({ brief, t, locale, chat, stops, artistName }: { brief: BriefDetail; t: Dict; locale: Locale; chat: ChatThread | null; stops: { id: string; label: string }[]; artistName: string }) {
  const s = t.studio.brief;
  const placement = PLACEMENT_BY_SLUG.get(brief.placement);
  const ct = dict(brief.client_locale);
  const first = brief.client_name.split(" ")[0];
  const refs = brief.files.filter((f) => f.kind === "reference");
  const skin = brief.files.find((f) => f.kind === "skin");
  const timing = brief.timing === "specific" && brief.preferred_dates ? brief.preferred_dates : t.brief.timing[brief.timing];
  const source = Object.entries(brief.attribution ?? {})
    .filter(([k]) => k.startsWith("utm_") || k === "referrer")
    .map(([, v]) => v)
    .join(", ");

  return (
    <article className="grid gap-8" aria-labelledby="brief-title">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`pill ${STATUS_TONE[brief.status]}`}>{statusLabel(brief.status, t)}</span>
          <span className="t-meta t-num">{brief.ref}</span>
          <span className="t-meta">{fill(s.received, { time: relativeTime(brief.created_at, locale) })}</span>
          {brief.is_coverup && <span className="pill text-ember">{s.coverup}</span>}
          {brief.is_first_tattoo && <span className="pill text-ash">{s.firstTattoo}</span>}
        </div>
        <h2 id="brief-title" className="t-title">
          {brief.client_name}
        </h2>
        <p className="font-serif text-[1.35rem] leading-snug text-vellum/90 italic">
          {placement?.label[locale]}
          {brief.full_coverage ? `, ${s.fullCoverage.toLowerCase()}` : brief.size_w_cm ? `, ${cmLabel(brief.size_w_cm, brief.size_h_cm)}` : ""}
        </p>
        {brief.flash_title && <p className="text-[0.95rem] text-gilt">{fill(t.artist.panel.flash.startedFrom, { title: brief.flash_title })}</p>}
        {brief.quote && brief.status === "quoted" && (
          <p className="text-[0.92rem] text-ash">
            {fill(s.quoteSent, { time: relativeTime(brief.quote.created_at, locale), amount: money(brief.quote.deposit_cents, brief.quote.currency, locale) })}{" "}
            <Link href={`/q/${brief.quote.token}`} className="link" target="_blank">
              {s.viewQuote}
            </Link>
          </p>
        )}
        <BriefActions
          briefId={brief.id}
          status={brief.status}
          labels={{
            quote: s.quote,
            ask: s.ask,
            decline: s.decline,
            archive: s.archive,
            reopen: s.reopen,
            askTitle: fill(t.studio.ask.title, { name: first }),
            askLead: t.studio.ask.lead,
            askSend: t.studio.ask.send,
            declineTitle: t.studio.decline.title,
            declineLead: fill(t.studio.decline.lead, { name: first }),
            declineConfirm: t.studio.decline.confirm,
            message: t.studio.ask.message,
            cancel: t.common.cancel,
          }}
          templates={{ ask: fill(ct.templates.ask, { name: first }), decline: fill(ct.templates.decline, { name: first }) }}
        />
      </header>

      {/* The conversation comes first: the request below is what it's about. */}
      {chat && (
        <section aria-labelledby="chat-title" className="grid gap-3 rounded-[var(--radius-lg)] border border-line p-4 sm:p-5">
          <h3 id="chat-title" className="t-label">
            {t.chat.conversation}
          </h3>
          <ArtistChat
            briefId={brief.id}
            items={chat.items}
            names={{ client: brief.client_name, artist: artistName }}
            t={t.chat}
            locale={locale}
            stops={stops}
            currency={brief.currency}
            canOffer={!["booked", "declined", "archived"].includes(brief.status) && stops.length > 0}
          />
        </section>
      )}

      <h3 className="t-label -mb-4">{t.chat.card.pinned}</h3>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-3">
          {placement && (
            <PlacementPreview
              body={brief.body}
              heightCm={brief.body_height_cm ?? (brief.body === "f" ? 167 : 178)}
              placement={brief.placement}
              widthCm={brief.size_w_cm}
              heightCmDesign={brief.size_h_cm}
              point={brief.placement_detail?.point}
              normal={brief.placement_detail?.normal}
              rotationDeg={brief.placement_detail?.rotation_deg}
              label={placement.label[locale]}
              front={t.brief.placement.front}
              back={t.brief.placement.back}
            />
          )}
          <p className="t-meta">
            {brief.body === "f" ? t.brief.placement.female : t.brief.placement.male}
          </p>
        </div>

        <div className="grid content-start gap-7">
          <section>
            <h3 className="t-label mb-2">{s.idea}</h3>
            <p className="max-w-[62ch] font-serif text-[1.2rem] leading-relaxed whitespace-pre-line">{brief.description}</p>
            {brief.avoid && (
              <p className="mt-4 max-w-[62ch] border-l-2 border-oxblood/60 pl-3 text-[0.95rem] whitespace-pre-line text-vellum/85">
                <span className="t-label block">{s.avoid}</span>
                {brief.avoid}
              </p>
            )}
          </section>

          {(refs.length > 0 || skin) && (
            <section>
              <h3 className="t-label mb-2">{s.references}</h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {refs.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-line bg-niche">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  </li>
                ))}
                {skin && (
                  <li>
                    <a href={skin.url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-ember/60 bg-niche">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={skin.url} alt={s.skin} className="h-full w-full object-cover" loading="lazy" />
                      <span className="absolute inset-x-0 bottom-0 bg-soot/80 px-2 py-1 text-[0.72rem]">{s.skin}</span>
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-[0.95rem]">
            <Fact label={s.style}>
              {styleLabel(brief.style, locale)}, {colorLabel(brief.color_mode, locale).toLowerCase()}
            </Fact>
            <Fact label={s.budget}>
              <span className="t-num">{moneyRange(brief.budget_min_cents, brief.budget_max_cents, brief.currency, locale)}</span>
            </Fact>
            <Fact label={s.timing}>{timing}</Fact>
            <Fact label={s.city}>{brief.city ?? s.anyCity}</Fact>
            <Fact label={s.client}>
              <a className="link break-all" href={`mailto:${brief.client_email}`}>
                {brief.client_email}
              </a>
              {brief.client_instagram && (
                <a className="link block" href={`https://instagram.com/${brief.client_instagram}`} target="_blank" rel="noreferrer">
                  @{brief.client_instagram}
                </a>
              )}
              {brief.client_phone && <span className="block text-ash">{brief.client_phone}</span>}
            </Fact>
            <Fact label={s.source}>{source || <span className="text-ash-dim">—</span>}</Fact>
          </dl>

        </div>
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="t-label">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
