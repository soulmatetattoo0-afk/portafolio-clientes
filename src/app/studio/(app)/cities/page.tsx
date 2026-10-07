import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { TIMEZONES } from "@/lib/catalog";
import { dateRange } from "@/lib/format";
import { listStops } from "@/lib/queries";

import { AddCity, CityRow } from "./CityForm";

export default async function CitiesPage() {
  const member = await requireMember();
  const [{ t, locale }, stops] = await Promise.all([getDict(), listStops(member.artistId)]);
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
      <AddCity labels={labels} timezones={TIMEZONES} />
    </main>
  );
}
