import { getDb } from "./db";
import { live } from "./env";

/** What still stands between the artist and launching their page. */
export async function launchChecklist(artistId: string) {
  const db = await getDb();
  const a = await db.one<{ portrait: boolean; magazine: boolean; styles: number; prices: boolean; screen: boolean; payments: boolean; works: number; launched_at: Date | null }>(
    `select a.portrait_path is not null as portrait, a.magazine is not null as magazine, coalesce(array_length(a.styles, 1), 0) as styles,
            (a.min_price_cents is not null and a.default_deposit_cents is not null) as prices, a.layout is not null as screen,
            a.stripe_charges_enabled as payments, a.launched_at,
            (select count(*)::int from portfolio_items p where p.artist_id = a.id and p.published and p.image_path is not null) as works
       from artists a where a.id = $1`,
    [artistId],
  );
  const items: { id: "name" | "portrait" | "magazine" | "works" | "styles" | "prices" | "screen" | "payments"; done: boolean; href: string }[] = [
    // Each step opens the pencil for exactly that thing on the artist's own page.
    { id: "name", done: true, href: "/studio/ajustes" },
    { id: "portrait", done: Boolean(a?.portrait), href: "/studio/ajustes" },
    { id: "magazine", done: Boolean(a?.magazine), href: "/studio/revista" },
    { id: "works", done: (a?.works ?? 0) >= 4, href: "/studio/obras" },
    { id: "styles", done: (a?.styles ?? 0) > 0, href: "/studio/ajustes" },
    { id: "prices", done: Boolean(a?.prices), href: "/studio/ajustes" },
    { id: "screen", done: Boolean(a?.screen), href: "/studio/pagina" },
  ];
  // Payouts only count where real money moves.
  if (live.payments) items.push({ id: "payments", done: Boolean(a?.payments), href: "/studio/ajustes" });
  return { items, ready: items.every((i) => i.done), launched: Boolean(a?.launched_at) };
}

