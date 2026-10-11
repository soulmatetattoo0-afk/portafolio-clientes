/**
 * TATTOO BY SOVA (Sasha): the first artist on VANTA with her own account.
 * Resident in Manhattan, New York; no guest spots yet. Her photographs ship
 * in public/demo/sova. Nothing is written about the pieces: titles, the bio
 * and the magazine's words stay empty so she writes them herself.
 */

import { SOVA_EMAIL, SOVA_USER_ID } from "./env";
import { placeCity } from "./geo";
import { frame, starterDoc, words } from "./magazine";
import type { Db } from "./db";

const img = (name: string) => `demo/sova/${name}.webp`;

/** [file, style, colour], in the order the gallery shows them. */
const PIECES: [string, string, "black_grey" | "color"][] = [
  ["justice", "realism", "black_grey"],
  ["dragon-sleeve", "japanese", "black_grey"],
  ["archangel", "realism", "black_grey"],
  ["we-all-float", "realism", "color"],
  ["cathedral-angel", "realism", "black_grey"],
  ["brush-dragon", "illustrative", "color"],
  ["zeus-sleeve", "realism", "black_grey"],
  ["color-smoke", "illustrative", "color"],
  ["athena", "realism", "black_grey"],
  ["nueva-york", "illustrative", "color"],
  ["moon-queen", "illustrative", "black_grey"],
  ["oni", "japanese", "black_grey"],
  ["spider", "blackwork", "black_grey"],
  ["feather", "illustrative", "color"],
  ["dancer", "fine_line", "black_grey"],
  ["dragon-sleeve-full", "japanese", "black_grey"],
];

export async function seedSova(db: Db) {
  const home = placeCity("New York", "United States");
  const studio = await db.one<{ id: string }>(`insert into studios (slug, name, kind, plan, subscription_status) values ('tattoo-by-sova', 'TATTOO BY SOVA', 'solo', 'founding', 'active') returning id`);
  const s = studio!.id;
  const artist = await db.one<{ id: string }>(
    `insert into artists (studio_id, slug, display_name, headline, bio, instagram, home_city, country, city_slug, lat, lng, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, portrait_path, trade, booking_mode)
     values ($1, 'sova', 'TATTOO BY SOVA', 'Versatile · black & grey and colour', null, null, 'New York', 'United States', $2, $3, $4,
       '{realism,illustrative,japanese,blackwork,fine_line}', null, 'usd', 'SOVA', null, null, '#c8231e', $5, 'tattoo', 'brief_quote')
     returning id`,
    [s, home.city_slug, home.lat, home.lng, img("cover")],
  );
  const a = artist!.id;
  await db.query(`insert into members (studio_id, user_id, email, role, locale, artist_id) values ($1, $2, $3, 'owner', 'es', $4)`, [s, SOVA_USER_ID, SOVA_EMAIL, a]);
  // Resident in Manhattan. The map shows this as her home; guest spots join it when she announces them.
  await db.query(
    `insert into tour_stops (studio_id, artist_id, city, country, city_slug, lat, lng, studio_name, address, timezone, status, is_home)
     values ($1, $2, 'New York', 'United States', $3, $4, $5, 'Manhattan', 'Manhattan, New York', 'America/New_York', 'booking', true)`,
    [s, a, home.city_slug, home.lat, home.lng],
  );
  for (const [i, [file, style, color]] of PIECES.entries()) {
    await db.query(
      `insert into portfolio_items (studio_id, artist_id, image_path, style, color_mode, sort, published_at) values ($1, $2, $3, $4, $5, $6, $7)`,
      [s, a, img(file), style, color, i, new Date(Date.now() - (2 + i * 6) * 24 * 3600 * 1000).toISOString()],
    );
  }

  // Her magazine starts laid out with her own photographs; every word is a prompt for her to replace.
  const doc = starterDoc(PIECES.map(([f]) => img(f)), img("cover"), img("portrait"));
  doc.pages.push({
    id: "sova-editorial",
    tone: "ink",
    boxes: [frame(img("editorial"), 4, 4, 92, 56, { fy: 40 }), frame(img("studio"), 4, 62, 44, 34, { fy: 30 }), words("caption", 52, 62, 44, 34, { font: "serif", size: 3.4 })],
  });
  await db.query(`update artists set magazine = $2::jsonb where id = $1`, [a, JSON.stringify(doc)]);
}
