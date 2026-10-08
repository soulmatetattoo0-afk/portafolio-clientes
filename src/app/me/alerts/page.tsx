import { getDict } from "@/i18n/server";
import { followedCities, requireClient } from "@/lib/client";
import { cityName } from "@/lib/geo";

import { toggleCityFollow } from "../actions";
import { ToggleButton } from "../ToggleButton";
import { PageHead, SectionHead } from "../ui";
import { AlertsForm } from "./AlertsForm";

export const metadata = { robots: { index: false } };

export default async function AlertsPage() {
  const me = await requireClient("/me/alerts");
  const [{ t }, cities] = await Promise.all([getDict(), followedCities(me.userId)]);
  const a = t.me.alerts;
  return (
    <div className="grid gap-10">
      <PageHead title={a.title} lead={a.lead} />
      <AlertsForm
        alerts={me.alerts}
        labels={{
          save: a.save,
          saved: a.saved,
          items: [
            { key: "spots", label: a.spots, hint: a.spotsHint },
            { key: "books_open", label: a.booksOpen, hint: a.booksOpenHint },
            { key: "issue", label: a.issue, hint: a.issueHint },
            { key: "new_work", label: a.newWork, hint: a.newWorkHint },
          ],
        }}
      />
      <section aria-labelledby="cities">
        <SectionHead id="cities">{a.cities}</SectionHead>
        <p className="mb-3 text-[0.92rem] text-bone-dim">{a.citiesHint}</p>
        {cities.size ? (
          <ul className="divide-y divide-line border-y border-line">
            {[...cities].sort().map((slug) => (
              <li key={slug} className="flex items-center justify-between gap-3 py-3">
                <span className="p-display text-[1.5rem] text-bone">{cityName(slug)}</span>
                <ToggleButton action={toggleCityFollow.bind(null, slug, "tattoo", "/me/alerts")} label={a.unfollowCity} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-bone-dim">{a.noCities}</p>
        )}
      </section>
    </div>
  );
}
