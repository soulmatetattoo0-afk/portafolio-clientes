import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { CareRoom } from "@/v2/CareRoom";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** Cuidados: the two letters the client receives, written on the paper itself. */
export default async function CareSheetsRoom() {
  const member = await requireMember();
  const [{ t }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.care} lead={t.v2.room.rooms.careLead}>
      <CareRoom artist={artist.display_name} precare={artist.precare ?? t.care.preDefault} postcare={artist.postcare ?? t.care.postDefault} t={t} />
    </Room>
  );
}
