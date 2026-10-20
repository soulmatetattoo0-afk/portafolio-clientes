import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { DepositForm } from "@/v2/DepositForm";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** Precios: the booking amount, the one that fills every quote by default. */
export default async function PricesRoom() {
  const member = await requireMember();
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.prices} lead={t.v2.room.rooms.pricesLead}>
      <DepositForm cents={artist.default_deposit_cents} currency={artist.currency} artist={artist.display_name} t={t} locale={locale} />
    </Room>
  );
}
