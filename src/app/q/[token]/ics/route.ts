import { env } from "@/lib/env";
import { placeLine } from "@/lib/format";
import { calendar } from "@/lib/ics";
import { placementLabel } from "@/lib/messages";
import { getQuoteByToken } from "@/lib/queries";

export async function GET(_request: Request, ctx: RouteContext<"/q/[token]/ics">) {
  const { token } = await ctx.params;
  const quote = await getQuoteByToken(token);
  if (!quote?.appointment) return new Response("Not found", { status: 404 });
  const ap = quote.appointment;
  const start = new Date(ap.starts_at);
  const hours = quote.hours_per_session ?? 4;
  const body = calendar(quote.artist_name, [
    {
      uid: `${quote.id}@brief`,
      start,
      end: new Date(start.getTime() + hours * 3600_000),
      summary: `Tattoo with ${quote.artist_name}: ${placementLabel(quote.placement, quote.client_locale)}`,
      location: placeLine(ap.studio_name, ap.address, ap.city),
      url: `${env.appUrl}/q/${token}`,
    },
  ]);
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="tattoo-session.ics"' },
  });
}
