import { PlanLock } from "@/components/PlanLock";
import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env, live } from "@/lib/env";
import { getMagazine } from "@/lib/magazine-server";
import { can } from "@/lib/plan";
import { getArtistById } from "@/lib/queries";
import { fileUrl } from "@/lib/storage";

import { MagazineEditor } from "./MagazineEditor";

export default async function MagazinePage() {
  const member = await requireMember();
  const [{ t }, artist, magazine] = await Promise.all([getDict(), getArtistById(member.artistId), getMagazine(member.artistId)]);
  const db = await getDb();
  const rows = await db.query<{ image_path: string }>(`select image_path from portfolio_items where artist_id = $1 and image_path is not null order by sort`, [member.artistId]);
  const library = await Promise.all(rows.map(async (r) => ({ key: r.image_path, url: await fileUrl("public", r.image_path) })));
  const e = t.magazine.editor;
  return (
    <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{e.title}</h1>
      <p className="mt-1 mb-6 max-w-[64ch] text-ash">{e.lead}</p>
      {can(member.plan, "magazine") ? (
        <MagazineEditor
          initial={magazine.doc}
          initialUrls={magazine.urls}
          library={library}
          name={artist?.display_name ?? ""}
          slug={artist?.slug ?? ""}
          accent={artist?.accent ?? "#d8552f"}
          t={t.magazine}
          storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
        />
      ) : (
        <PlanLock text={t.studio.plan.locked} cta={t.studio.plan.upgrade} />
      )}
    </main>
  );
}
