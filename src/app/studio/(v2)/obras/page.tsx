import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getArtistById, listPortfolio, listSections } from "@/lib/queries";
import { WorkEditor } from "@/v2/WorkEditor";
import { storageForBrowser } from "@/v2/pages";

export const metadata = { robots: { index: false } };

export default async function WorkEditorPage() {
  const member = await requireMember();
  const [{ t, locale }, pieces, sections, artist] = await Promise.all([getDict(), listPortfolio(member.artistId), listSections(member.artistId), getArtistById(member.artistId)]);
  return <WorkEditor pieces={pieces.filter((p) => p.url)} sections={sections} cover={artist?.work_cover_url ?? null} storage={storageForBrowser()} t={t} locale={locale} back="/studio/pagina/obras" />;
}
