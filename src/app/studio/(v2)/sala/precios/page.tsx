import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { Room } from "@/v2/Room";
import { SettingsForm } from "@/v2/SettingsForm";
import { storageForBrowser } from "@/v2/pages";

export const metadata = { robots: { index: false } };

/** Precios: where pieces start, the booking cost, whether quotes are open. */
export default async function PricesRoom() {
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.prices} lead={t.v2.room.rooms.pricesLead}>
      <SettingsForm artist={artist} storage={storageForBrowser()} t={t} locale={locale} only={["prices"]} />
    </Room>
  );
}
