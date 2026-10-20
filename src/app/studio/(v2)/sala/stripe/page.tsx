import { refreshStripeStatus, startStripeConnect } from "@/app/studio/_legacy/actions";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { live } from "@/lib/env";
import { getArtistById } from "@/lib/queries";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** Stripe: the artist's own account for card payments, connected from here; until VANTA turns cards on, direct payments. */
export default async function StripeRoom({ searchParams }: PageProps<"/studio/sala/stripe">) {
  const member = await requireMember();
  // Back from Stripe's onboarding: ask Stripe whether the account can take payments now.
  if ((await searchParams).stripe === "return") await refreshStripeStatus().catch(() => undefined);
  const [{ t }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room.rooms;
  const state = !live.payments ? "off" : artist.stripe_charges_enabled ? "ok" : artist.stripe_account_id ? "pending" : "new";
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.stripe} lead={r.stripeLead}>
      <section className="v2-sheet grid gap-3 p-5">
        <p className="p-stamp text-bone/60">{r.stripeState}</p>
        <p className={`p-display text-[1.8rem] uppercase leading-none ${state === "ok" ? "text-[var(--color-olive,#6f8f5c)]" : state === "off" ? "text-bone" : "text-accent"}`}>
          {state === "ok" ? r.stripeOk : state === "pending" ? r.stripePending : state === "new" ? r.stripeNew : r.stripeOff}
        </p>
        <p className="text-[0.92rem] leading-snug text-bone/80">{state === "off" ? r.stripeOffLead : state === "ok" ? r.stripeOkLead : r.stripeConnectLead}</p>
        {state !== "off" && (
          <form action={startStripeConnect}>
            <button type="submit" className="v2-btn w-full" data-tone={state === "ok" ? "ghost" : "accent"}>
              {state === "ok" ? r.stripeManage : state === "pending" ? r.stripeContinue : r.stripeConnect}
            </button>
          </form>
        )}
      </section>
      <section className="v2-sheet grid gap-2 p-5">
        <p className="p-stamp text-bone/60">{r.stripeHow}</p>
        <ol className="grid gap-2 text-[0.9rem] leading-snug text-bone/80">
          {r.stripeSteps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="p-display text-[1.1rem] leading-none text-accent">{i + 1}</span>
              <span>{fill(step, { artist: artist.display_name })}</span>
            </li>
          ))}
        </ol>
      </section>
    </Room>
  );
}
