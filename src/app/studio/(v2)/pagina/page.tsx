import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { FrontPage } from "@/v2/pages";

/** Mi página: the artist's page exactly as the client sees it; the edit buttons wait inside each door. */
export default async function Page() {
  const member = await requireMember();
  const artist = await getArtistById(member.artistId);
  if (!artist) return null;
  return <FrontPage artist={artist} owner base="/studio/pagina" />;
}
