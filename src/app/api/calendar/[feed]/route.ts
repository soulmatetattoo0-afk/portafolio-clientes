import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { calendar } from "@/lib/ics";
import { placementLabel } from "@/lib/messages";
import { verify } from "@/lib/util";

/** Private calendar feed for an artist: /api/calendar/<studioId>.<signature>.ics */
export async function GET(_request: Request, ctx: RouteContext<"/api/calendar/[feed]">) {
  const { feed } = await ctx.params;
  const [studioId, sig] = feed.replace(/\.ics$/, "").split(".");
  if (!studioId || !sig || !verify(`cal:${studioId}`, sig)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const rows = await db.query<{ id: string; starts_at: Date; ends_at: Date; city: string | null; client: string; placement: string | null; brief_id: string | null; artist: string }>(
    `select ap.id, ap.starts_at, ap.ends_at, ap.city, c.name as client, b.placement, ap.brief_id, a.display_name as artist
       from appointments ap join clients c on c.id = ap.client_id left join briefs b on b.id = ap.brief_id join artists a on a.id = ap.artist_id
      where ap.studio_id = $1 and ap.status = 'confirmed' and ap.starts_at > now() - interval '60 days'
      order by ap.starts_at`,
    [studioId],
  );
  const body = calendar(rows[0]?.artist ?? "Bookings", rows.map((r) => ({
    uid: `${r.id}@brief`,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    summary: `${r.client}: ${r.placement ? placementLabel(r.placement, "en") : "Session"}`,
    location: r.city,
    url: r.brief_id ? `${env.appUrl}/studio?brief=${r.brief_id}` : null,
  })));
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
}
