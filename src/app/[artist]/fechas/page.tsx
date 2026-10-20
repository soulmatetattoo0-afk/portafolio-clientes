import { DatesPage, loadArtist } from "@/v2/pages";

export const metadata = { robots: { index: false } };

export default async function Page({ params }: PageProps<"/[artist]/fechas">) {
  const { artist: slug } = await params;
  const artist = await loadArtist(slug);
  return <DatesPage artist={artist} owner={false} base={`/${artist.slug}`} />;
}
