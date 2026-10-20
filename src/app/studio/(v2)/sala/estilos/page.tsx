import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById, listSections } from "@/lib/queries";
import { OwnStyles } from "@/v2/OwnStyles";
import { Room } from "@/v2/Room";
import { SettingsForm } from "@/v2/SettingsForm";
import { storageForBrowser } from "@/v2/pages";

export const metadata = { robots: { index: false } };

/** Estilos: the artist's own named styles first, then the classic ones they work in. */
export default async function StylesRoom() {
  const member = await requireMember();
  const [{ t, locale }, artist, sections] = await Promise.all([getDict(), getArtistById(member.artistId), listSections(member.artistId)]);
  if (!artist) return null;
  return (
    <Room artist={artist} t={t} title={t.v2.room.tile.styles} lead={t.v2.room.rooms.stylesLead}>
      <OwnStyles sections={sections} t={t} />
      <SettingsForm artist={artist} storage={storageForBrowser()} t={t} locale={locale} only={["styles"]} />
    </Room>
  );
}
