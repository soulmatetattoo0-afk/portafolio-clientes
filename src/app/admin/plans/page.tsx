import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

import { regeocode } from "../actions";
import { PlanSelect } from "./PlanSelect";

interface Row {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  artist: string | null;
  city: string | null;
  city_slug: string | null;
}

export default async function PlansPage({ searchParams }: PageProps<"/admin/plans">) {
  await requireAdmin();
  const [{ t }, sp, db] = await Promise.all([getDict(), searchParams, getDb()]);
  const a = t.admin.plans;
  const rows = await db.query<Row>(
    `select s.id, s.name, s.plan, s.subscription_status, ar.display_name as artist, ar.home_city as city, ar.city_slug
       from studios s
       left join lateral (select display_name, home_city, city_slug from artists where studio_id = s.id order by created_at limit 1) ar on true
      order by s.created_at`,
  );
  const geocoded = typeof sp.geocoded === "string" ? Number(sp.geocoded) : null;
  const tiers = Object.entries(a.tiers) as [string, string][];
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{a.title}</h1>
      <p className="mt-1 mb-8 max-w-[60ch] text-ash">{a.lead}</p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] border-collapse text-[0.92rem]">
          <thead>
            <tr className="border-b border-line text-left">
              {[a.studio, a.artist, a.city, a.plan, a.status].map((h) => (
                <th key={h} scope="col" className="t-label py-2 pr-4 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-3 pr-4 font-serif text-[1.1rem]">{r.name}</td>
                <td className="py-3 pr-4">{r.artist ?? "—"}</td>
                <td className="py-3 pr-4">
                  {r.city ?? "—"}
                  {r.city && !r.city_slug ? <span className="ml-2 text-ash-dim">·</span> : null}
                </td>
                <td className="py-3 pr-4">
                  <PlanSelect studioId={r.id} plan={r.plan} tiers={tiers} label={`${a.plan}: ${r.name}`} saved={a.saved} error={t.common.error} />
                </td>
                <td className="t-num py-3 pr-4 text-ash">{r.subscription_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={regeocode} className="mt-10 grid gap-2 border-t border-line pt-8">
        <button type="submit" className="btn btn-secondary w-fit">
          {a.regeocode}
        </button>
        <p className="text-[0.85rem] text-ash-dim">{a.regeocodeHint}</p>
        {geocoded != null && Number.isFinite(geocoded) ? (
          <p role="status" className="text-[0.9rem] text-verdigris">
            {fill(a.regeocoded, { n: geocoded })}
          </p>
        ) : null}
      </form>
    </main>
  );
}
