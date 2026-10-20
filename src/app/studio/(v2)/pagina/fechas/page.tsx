import { requireMember } from "@/lib/auth";
import { getArtistById } from "@/lib/queries";
import { DatesPage } from "@/v2/pages";

export default async function Page({ searchParams }: PageProps<"/studio/pagina/fechas">) {
  const member = await requireMember();
  const artist = await getArtistById(member.artistId);
  if (!artist) return null;
  return <DatesPage artist={artist} owner base="/studio/pagina" edit={(await searchParams).edit === "1"} />;
}
