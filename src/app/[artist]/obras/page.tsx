import { WorkPage, loadArtist } from "@/v2/pages";

export const metadata = { robots: { index: false } };

export default async function Page({ params }: PageProps<"/[artist]/obras">) {
  const { artist: slug } = await params;
  const artist = await loadArtist(slug);
  return <WorkPage artist={artist} owner={false} base={`/${artist.slug}`} />;
}
