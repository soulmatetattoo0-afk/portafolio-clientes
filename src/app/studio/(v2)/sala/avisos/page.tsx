import { StudioPush } from "@/app/studio/_legacy/StudioPush";
import { fill } from "@/i18n";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { live } from "@/lib/env";
import { getArtistById } from "@/lib/queries";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** Avisos: notifications on the phone (no App Store needed) and by email. */
export default async function AlertsRoom() {
  const member = await requireMember();
  const [{ t }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const r = t.v2.room.rooms;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.push} lead={r.pushLead}>
      <section className="v2-sheet grid gap-3 p-5">
        <p className="p-stamp text-bone/60">{r.pushPhone}</p>
        <StudioPush t={t} className="" />
        <div className="grid gap-3 text-[0.9rem] leading-snug text-bone/80">
          <div>
            <p className="font-semibold text-bone">iPhone</p>
            <ol className="mt-1 grid list-decimal gap-1 pl-5">
              {r.pushIphone.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-semibold text-bone">Android</p>
            <p className="mt-1">{r.pushAndroid}</p>
          </div>
        </div>
      </section>
      <section className="v2-sheet grid gap-2 p-5">
        <p className="p-stamp text-bone/60">{r.pushEmail}</p>
        <p className="text-[0.92rem] leading-snug text-bone/80">{live.email ? fill(r.emailOn, { email: member.email }) : r.emailOff}</p>
      </section>
    </Room>
  );
}
