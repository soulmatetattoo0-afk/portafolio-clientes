import { MagazinePage, loadArtist } from "@/v2/pages";

export const metadata = { robots: { index: false } };

export default async function Page({ params }: PageProps<"/[artist]/revista">) {
  const { artist: slug } = await params;
  const artist = await loadArtist(slug);
  return <MagazinePage artist={artist} owner={false} base={`/${artist.slug}`} />;
}
