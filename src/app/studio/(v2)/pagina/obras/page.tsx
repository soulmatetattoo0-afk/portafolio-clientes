import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { WorkPage } from "@/v2/pages";

export default async function Page() {
  const member = await requireMember();
  const artist = await getArtistById(member.artistId);
  if (!artist) return null;
  return <WorkPage artist={artist} owner base="/studio/pagina" />;
}
