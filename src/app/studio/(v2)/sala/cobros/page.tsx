import { unlinkMercadoPago } from "@/app/studio/_legacy/actions";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { demoMode, env, live } from "@/lib/env";
import { money } from "@/lib/format";
import { serviceFee } from "@/lib/mercadopago";
import { getArtistById } from "@/lib/queries";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/**
 * Cobros (Chile): the artist links their own Mercado Pago, and from then on
 * clients pay the deposit in the app. The artist receives the deposit whole;
 * the client adds VANTA's service fee. Until linked, clients pay directly.
 */
export default async function PaymentsRoom({ searchParams }: PageProps<"/studio/sala/cobros">) {
  const member = await requireMember();
  const sp = await searchParams;
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room.rooms.mp;
  const state = live.mp ? (artist.mp_ready ? "ok" : "new") : demoMode ? "demo" : "off";
  const example = artist.default_deposit_cents || 5_000_000;
  const fee = serviceFee(example);
  const flash = sp.mp === "ok" ? r.flashOk : sp.mp === "error" ? r.flashError : sp.mp === "cancelled" ? r.flashCancelled : null;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.payments} lead={r.lead}>
      {flash && <p role="status" className={`v2-sheet p-4 text-[0.92rem] ${sp.mp === "ok" ? "text-bone" : "text-accent"}`}>{flash}</p>}
      <section className="v2-sheet grid gap-3 p-5">
        <p className="p-stamp text-bone/60">{r.state}</p>
        <p className={`p-display text-[1.8rem] uppercase leading-none ${state === "ok" ? "text-[var(--color-olive,#6f8f5c)]" : state === "new" ? "text-accent" : "text-bone"}`}>
          {state === "ok" ? r.ok : state === "new" ? r.new : state === "demo" ? r.demo : r.off}
        </p>
        <p className="text-[0.92rem] leading-snug text-bone/80">{state === "ok" ? r.okLead : state === "new" ? r.newLead : state === "demo" ? r.demoLead : r.offLead}</p>
        {state === "new" && (
          // Off to Mercado Pago through VANTA's own route, which signs who is asking.
          <form action="/api/mp/connect" method="get">
            <button type="submit" className="v2-btn w-full" data-tone="accent">
              {r.connect}
            </button>
          </form>
        )}
        {state === "ok" && (
          <form action={unlinkMercadoPago}>
            <button type="submit" className="v2-btn w-full" data-tone="ghost">
              {r.unlink}
            </button>
          </form>
        )}
      </section>
      <section className="v2-sheet grid gap-2 p-5">
        <p className="p-stamp text-bone/60">{r.exampleTitle}</p>
        <p className="flex justify-between gap-3 text-[0.92rem]"><span className="text-bone/70">{r.exampleDeposit}</span><span>{money(example, artist.currency, locale)}</span></p>
        <p className="flex justify-between gap-3 text-[0.92rem]"><span className="text-bone/70">{r.exampleFee}</span><span>{money(fee, artist.currency, locale)}</span></p>
        <p className="flex justify-between gap-3 border-t border-bone/10 pt-2 text-[0.92rem] font-semibold"><span>{r.exampleYou}</span><span>{money(example, artist.currency, locale)}</span></p>
        <p className="pt-1 text-[0.82rem] leading-snug text-bone/60">{fill(r.exampleNote, { pct: String(env.serviceFeeBps / 100) })}</p>
      </section>
      <section className="v2-sheet grid gap-2 p-5">
        <p className="p-stamp text-bone/60">{r.policyTitle}</p>
        <ul className="grid gap-2 text-[0.9rem] leading-snug text-bone/80">
          {r.policy.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden className="text-accent">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </Room>
  );
}
