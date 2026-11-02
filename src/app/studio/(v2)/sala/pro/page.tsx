import { cancelProSubscription, refreshProSubscription, startProSubscription } from "@/app/studio/_legacy/actions";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { money } from "@/lib/format";
import { isFull } from "@/lib/plan";
import { getArtistById } from "@/lib/queries";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** VANTA Pro: the monthly subscription that opens more of the system; paid on Mercado Pago from Chile. What it includes is announced here as it grows. */
export default async function ProRoom({ searchParams }: PageProps<"/studio/sala/pro">) {
  // Back from Mercado Pago: ask how the subscription stands before reading the plan.
  if ((await searchParams).pro === "back") await refreshProSubscription().catch(() => undefined);
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room.rooms.pro;
  // Read fresh: the member was looked up (and remembered for this request) before Mercado Pago was asked.
  const plan = (await (await getDb()).one<{ plan: string }>(`select plan from studios where id = $1`, [member.studioId]))?.plan ?? member.plan;
  const pro = isFull(plan);
  const ready = live.mp && Boolean(env.mpAccessToken);
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.pro} lead={r.lead}>
      <section className="v2-sheet grid gap-3 p-5">
        <p className="p-stamp text-bone/60">{r.state}</p>
        <p className={`p-display text-[1.8rem] uppercase leading-none ${pro ? "text-[var(--color-olive,#6f8f5c)]" : "text-bone"}`}>{pro ? r.active : r.free}</p>
        <p className="p-display text-[2.6rem] leading-none">
          {money(env.proPriceClp * 100, "clp", locale)}
          <span className="ml-2 align-middle font-sans text-[0.9rem] text-bone/60">{r.perMonth}</span>
        </p>
        <p className="text-[0.92rem] leading-snug text-bone/80">{r.soon}</p>
        {!pro &&
          (ready ? (
            <form action={startProSubscription}>
              <button type="submit" className="v2-btn w-full" data-tone="accent">
                {r.subscribe}
              </button>
            </form>
          ) : (
            <p className="text-[0.85rem] text-bone/60">{r.off}</p>
          ))}
        {pro && plan !== "founding" && (
          <form action={cancelProSubscription}>
            <button type="submit" className="v2-btn w-full" data-tone="ghost">
              {r.cancel}
            </button>
          </form>
        )}
        <p className="text-[0.8rem] leading-snug text-bone/50">{fill(r.fine, { price: money(env.proPriceClp * 100, "clp", locale) })}</p>
      </section>
    </Room>
  );
}
