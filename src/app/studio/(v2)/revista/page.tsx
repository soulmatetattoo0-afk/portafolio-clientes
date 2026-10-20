import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMagazine } from "@/lib/magazine-server";
import { getArtistById, listPortfolio } from "@/lib/queries";
import { fileUrl } from "@/lib/storage";
import { MagEditor } from "@/v2/MagEditor";
import { storageForBrowser } from "@/v2/pages";

export const metadata = { robots: { index: false } };

export default async function MagazineEditorPage() {
  const member = await requireMember();
  const [{ t, locale }, artist, magazine, portfolio] = await Promise.all([getDict(), getArtistById(member.artistId), getMagazine(member.artistId), listPortfolio(member.artistId, { publishedOnly: true })]);
  if (!artist) return null;
  const db = await import("@/lib/db").then((x) => x.getDb());
  const rows = await db.query<{ image_path: string }>(`select image_path from portfolio_items where artist_id = $1 and image_path is not null order by sort`, [member.artistId]);
  const photos = await Promise.all(rows.map(async (r) => ({ key: r.image_path, url: await fileUrl("public", r.image_path) })));
  void portfolio;
  return <MagEditor artist={artist} initial={magazine.doc} initialUrls={magazine.urls} photos={photos} storage={storageForBrowser()} t={t} locale={locale} back="/studio/pagina/revista" />;
}
