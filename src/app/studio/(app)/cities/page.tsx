import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { TIMEZONES } from "@/lib/catalog";
import { dateRange } from "@/lib/format";
import { listCityDemand, listStops } from "@/lib/queries";

import { AddCity, CityRow } from "./CityForm";

export default async function CitiesPage({ searchParams }: PageProps<"/studio/cities">) {
  const member = await requireMember();
  const [{ t, locale }, stops, demand, sp] = await Promise.all([getDict(), listStops(member.artistId), listCityDemand(member.artistId), searchParams]);
  const prefill = typeof sp.city === "string" ? sp.city : undefined;
  const c = t.studio.cities;
  const labels = {
    add: c.add,
    city: c.city,
    country: c.country,
    studio: c.studio,
    address: c.address,
    timezone: c.timezone,
    starts: c.starts,
    ends: c.ends,
    home: c.home,
    status: c.status,
    save: c.save,
    notify: c.notify,
    delete: c.delete,
    cancel: t.common.cancel,
    edit: t.common.edit,
    statuses: t.artist.status,
    optional: t.common.optional,
  };
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{c.title}</h1>
      <p className="mt-1 mb-8 max-w-[60ch] text-ash">{c.lead}</p>
      {stops.length === 0 ? (
        <p className="mb-6 rounded-[var(--radius-lg)] border border-dashed border-line p-6 text-ash">{c.empty}</p>
      ) : (
        <div className="mb-8 divide-y divide-line border-y border-line">
          {stops.map((s) => (
            <CityRow
              key={s.id}
              stop={s}
              labels={labels}
              timezones={TIMEZONES}
              dates={dateRange(s.starts_on, s.ends_on, locale)}
              waitlistLabel={s.waitlist_count ? fill(c.waitlist, { n: s.waitlist_count }) : null}
            />
          ))}
        </div>
      )}
      <AddCity labels={labels} timezones={TIMEZONES} initialCity={prefill} />

      {demand.length > 0 && (
        <section className="mt-12 border-t border-line pt-8" aria-labelledby="demand">
          <h2 id="demand" className="t-heading">
            {c.demandTitle}
          </h2>
          <p className="mt-1 mb-5 max-w-[60ch] text-ash">{c.demandLead}</p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {demand.map((d, i) => (
              <li key={d.city} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line px-4 py-3">
                <span className="min-w-0">
                  <span className="t-meta t-num mr-2">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-serif text-[1.25rem]">{d.city}</span>
                  <span className="t-num ml-2 text-ash">{fill(c.demandCount, { n: d.n })}</span>
                </span>
                <a href={`/studio/cities?city=${encodeURIComponent(d.city)}#add-city`} className="btn btn-secondary btn-sm shrink-0">
                  {c.demandAdd}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
