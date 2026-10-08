/**
 * The world around the first two artists: ten more artists in ten cities so
 * search, city pages and the magazine have something to show, plus one
 * client with an account. Only runs with the demo seed.
 */
import type { Db } from "./db";
import { DEMO_CLIENT_EMAIL, DEMO_CLIENT_USER_ID } from "./env";
import { placeCity } from "./geo";

const DAY = 24 * 3600 * 1000;
const dateOnly = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);

type Piece = [title: string, style: string, color: "black_grey" | "color", placement: string, healed: boolean, story: string | null];
type Spot = [city: string, country: string, studio: string, tz: string, startDay: number, endDay: number, status: "announced" | "booking"];
interface Seed {
  slug: string;
  name: string;
  studio: string;
  plan: "basic" | "full";
  headline: string;
  bio: string;
  instagram: string;
  city: string;
  country: string;
  tz: string;
  styles: string[];
  priceFrom: number;
  accent: string;
  word: string;
  quote: string;
  since: number;
  accepting?: boolean;
  pieces: Piece[];
  spots?: Spot[];
}

const ARTISTS: Seed[] = [
  {
    slug: "mara-vuk", name: "Mara Vuković", studio: "Vuk Tattoo", plan: "full", headline: "Traditional with a clean hand", bio: "Bold lines, flat colour, nothing that will not read from across the room. I keep a book of my own flash and I tattoo it the way it was drawn.", instagram: "mara.vuk", city: "New York", country: "United States", tz: "America/New_York", styles: ["traditional", "neo_traditional"], priceFrom: 20000, accent: "#1f6f8b", word: "TRADITIONAL", quote: "Bold will hold.", since: 2012,
    pieces: [["Panther & dagger", "traditional", "color", "upper_arm_L", true, "The classic, drawn from a 1940s sheet and cut for a forearm that moves. One sitting, healed in two weeks."], ["Ship in a storm", "traditional", "color", "chest_R", true, null], ["Rose with a name", "traditional", "black_grey", "forearm_outer_R", false, null], ["Swallow pair", "traditional", "color", "chest_L", true, "Two swallows, one for each crossing. The oldest tattoo idea there is, and still the best."], ["Snake over skull", "neo_traditional", "color", "thigh_R", false, null], ["Tiger head", "traditional", "color", "calf_L", true, null]],
    spots: [["Austin", "United States", "Red River Social", "America/Chicago", 12, 16, "booking"]],
  },
  {
    slug: "theo-lind", name: "Theo Lindqvist", studio: "Lind Fine Line", plan: "basic", headline: "Single-needle fine line and botanicals", bio: "Small, quiet pieces that look drawn with a pencil: plants, hands, script, the things people carry close. Based in Brooklyn.", instagram: "theo.lind", city: "New York", country: "United States", tz: "America/New_York", styles: ["fine_line", "lettering", "illustrative"], priceFrom: 15000, accent: "#6b7a5a", word: "FINE LINE", quote: "Less ink, more intent.", since: 2019,
    pieces: [["Olive branch", "fine_line", "black_grey", "forearm_inner_L", true, "An olive branch from her grandmother's garden in Crete, drawn from a pressed cutting she brought in."], ["Mother's handwriting", "lettering", "black_grey", "ribs_R", true, null], ["Two cranes", "fine_line", "black_grey", "shoulder_R", false, null], ["Fern frond", "fine_line", "black_grey", "calf_R", true, null]],
  },
  {
    slug: "kenji-okada", name: "Kenji Okada", studio: "Okada Horimono", plan: "full", headline: "Japanese bodysuits and large flow", bio: "Irezumi built around the body: koi, dragons, wind bars and water that moves with the muscle. Big work in many sessions, planned together before the first line.", instagram: "okada.horimono", city: "Los Angeles", country: "United States", tz: "America/Los_Angeles", styles: ["japanese", "blackwork"], priceFrom: 40000, accent: "#b3261e", word: "IREZUMI", quote: "The body is the composition.", since: 2008,
    pieces: [["Koi against the current", "japanese", "color", "sleeve_full_R", true, "A full sleeve, eleven sessions over a year. The koi climbs the arm; the water carries the wind bars around the elbow."], ["Dragon back piece", "japanese", "color", "back_full", false, "Started in spring, the outline finished in two days. The colour is a year of Saturdays."], ["Peony and snake", "japanese", "color", "thigh_L", true, null], ["Hannya mask", "japanese", "black_grey", "calf_R", true, null], ["Wind bars", "blackwork", "black_grey", "forearm_outer_L", true, null], ["Chrysanthemum", "japanese", "color", "chest_R", false, null], ["Tiger and bamboo", "japanese", "color", "back_upper", true, null]],
    spots: [["New York", "United States", "Soulmate Tattoo", "America/New_York", 24, 30, "booking"], ["Miami", "United States", "Ocean Drive Ink", "America/New_York", 50, 55, "announced"]],
  },
  {
    slug: "lucia-ferro", name: "Lucía Ferro", studio: "Ferro Studio", plan: "full", headline: "Neo-traditional in full colour", bio: "Ornamental neo-traditional: women, animals and jewels with heavy outlines and saturated colour that stays bright after healing. Miami, with guest spots up the coast.", instagram: "lucia.ferro", city: "Miami", country: "United States", tz: "America/New_York", styles: ["neo_traditional", "illustrative"], priceFrom: 25000, accent: "#c2185b", word: "NEO", quote: "Colour that heals loud.", since: 2015,
    pieces: [["Lady with moth", "neo_traditional", "color", "thigh_R", true, "A portrait of nobody in particular, with a moth where the heart would be. Three sessions, the gold leaf effect in the frame took one of them."], ["Fox and jewels", "neo_traditional", "color", "upper_arm_R", true, null], ["Owl in a frame", "neo_traditional", "color", "calf_L", false, null], ["Dagger heart", "neo_traditional", "color", "forearm_inner_R", true, null], ["Serpent crown", "illustrative", "black_grey", "back_upper", true, null]],
    spots: [["New York", "United States", "Nocturne Studio", "America/New_York", 8, 12, "booking"]],
  },
  {
    slug: "diego-arana", name: "Diego Arana", studio: "Arana Negro", plan: "basic", headline: "Blackwork, geometry and dotwork", bio: "Solid black, patterns that follow the muscle, sacred geometry drawn by hand. Big sleeves and leg pieces, no colour, no shortcuts.", instagram: "arana.negro", city: "Mexico City", country: "Mexico", tz: "America/Mexico_City", styles: ["blackwork", "illustrative"], priceFrom: 12000, accent: "#2b2b2b", word: "NEGRO", quote: "Black is the whole palette.", since: 2014,
    pieces: [["Ornamental sleeve", "blackwork", "black_grey", "sleeve_full_L", true, "Mandalas at the shoulder and the elbow, the pattern between them drawn straight on the arm with a marker over two days."], ["Dotwork sun", "blackwork", "black_grey", "chest_center", true, null], ["Geometric leg", "blackwork", "black_grey", "leg_sleeve_R", false, null], ["Jaguar lines", "illustrative", "black_grey", "forearm_outer_L", true, null], ["Nahui Ollin", "blackwork", "black_grey", "back_upper", true, null]],
    spots: [["Los Angeles", "United States", "Golden Hour Tattoo", "America/Los_Angeles", 20, 25, "booking"]],
  },
  {
    slug: "elena-sanz", name: "Elena Sanz", studio: "Sanz Realismo", plan: "full", headline: "Black and grey realism, portraits", bio: "Faces, hands and animals in soft black and grey. Madrid, with a yearly tour through Barcelona, London and New York.", instagram: "elena.sanz.tattoo", city: "Madrid", country: "Spain", tz: "Europe/Madrid", styles: ["realism", "surrealism"], priceFrom: 28000, accent: "#8d6e63", word: "RETRATO", quote: "Skin remembers a face.", since: 2011,
    pieces: [["Grandfather at the harbour", "realism", "black_grey", "forearm_inner_R", true, "From a photograph taken in Vigo in 1958. Four hours, the water in the background was the hard part."], ["Lion in dust", "realism", "black_grey", "upper_arm_L", true, null], ["Horse and veil", "surrealism", "black_grey", "thigh_L", false, "A horse wearing a bride's veil, for a rider who stopped riding. The veil is where the softness lives."], ["Clock and eye", "surrealism", "black_grey", "calf_R", true, null], ["Praying hands", "realism", "black_grey", "chest_L", true, null], ["Wolf portrait", "realism", "black_grey", "shoulder_R", true, null]],
    spots: [["New York", "United States", "Soulmate Tattoo", "America/New_York", 36, 42, "announced"], ["London", "United Kingdom", "Saint Ink", "Europe/London", 60, 66, "announced"]],
  },
  {
    slug: "pol-casals", name: "Pol Casals", studio: "Casals Ink", plan: "basic", headline: "Fine line, micro realism", bio: "Tiny realistic pieces and delicate line work: portraits the size of a coin, flowers, animals. Barcelona.", instagram: "pol.casals", city: "Barcelona", country: "Spain", tz: "Europe/Madrid", styles: ["fine_line", "realism"], priceFrom: 10000, accent: "#5c6bc0", word: "MICRO", quote: "Small and exact.", since: 2020,
    pieces: [["Micro portrait of a dog", "realism", "black_grey", "forearm_inner_L", true, null], ["Lavender sprig", "fine_line", "color", "ribs_L", true, null], ["Tiny world map", "fine_line", "black_grey", "shoulder_L", false, null], ["Bee on a stem", "fine_line", "color", "hand_R", true, null]],
  },
  {
    slug: "amos-reed", name: "Amos Reed", studio: "Reed Letters", plan: "full", headline: "Lettering and script, chicano to gothic", bio: "Letters are my whole practice: script, blackletter, chicano fine script, names and dates. London, Hackney.", instagram: "reed.letters", city: "London", country: "United Kingdom", tz: "Europe/London", styles: ["lettering", "blackwork"], priceFrom: 18000, accent: "#d4a017", word: "LETTERS", quote: "A word, well set.", since: 2013,
    pieces: [["Blackletter forearm", "lettering", "black_grey", "forearm_outer_L", true, "Her father's motto in a blackletter cut I drew for her, the ascenders following the bone."], ["Fine script collarbone", "lettering", "black_grey", "chest_center", true, null], ["Date in roman numerals", "lettering", "black_grey", "ribs_R", false, null], ["Chicano script", "lettering", "black_grey", "hand_L", true, null], ["Gothic 'Family'", "lettering", "black_grey", "back_upper", true, null]],
    spots: [["New York", "United States", "Nocturne Studio", "America/New_York", 15, 19, "booking"]],
  },
  {
    slug: "nika-berg", name: "Nika Berg", studio: "Berg Schwarz", plan: "basic", headline: "Blackwork, brutalist and abstract", bio: "Hard black shapes, abstract composition, architecture on skin. Berlin, Kreuzberg.", instagram: "berg.schwarz", city: "Berlin", country: "Germany", tz: "Europe/Berlin", styles: ["blackwork", "surrealism"], priceFrom: 16000, accent: "#37474f", word: "SCHWARZ", quote: "Shape before meaning.", since: 2017,
    pieces: [["Concrete forms", "blackwork", "black_grey", "thigh_R", true, "Four shapes from a Brutalist housing block in Lichtenberg, scaled to a thigh."], ["Broken grid", "blackwork", "black_grey", "upper_arm_R", true, null], ["Abstract back", "blackwork", "black_grey", "back_full", false, null], ["Ink field", "blackwork", "black_grey", "calf_L", true, null]],
  },
  {
    slug: "sara-mendez", name: "Sara Méndez", studio: "Méndez Ilustra", plan: "full", headline: "Illustrative colour, botanicals and animals", bio: "Watercolour-feeling illustration with a clean line underneath so it heals well: birds, orchids, cats, the Andes. Bogotá.", instagram: "mendez.ilustra", city: "Bogotá", country: "Colombia", tz: "America/Bogota", styles: ["illustrative", "fine_line"], priceFrom: 9000, accent: "#2e7d32", word: "FLORA", quote: "Drawn first, then tattooed.", since: 2016,
    pieces: [["Hummingbird and orchid", "illustrative", "color", "shoulder_L", true, "Colombia's two national symbols, drawn from the Jardín Botánico. The orchid's purple took two passes."], ["Andean condor", "illustrative", "black_grey", "back_upper", true, null], ["Cat in a window", "illustrative", "color", "forearm_inner_R", false, null], ["Heliconia", "illustrative", "color", "thigh_L", true, null], ["Frailejón", "fine_line", "color", "calf_R", true, null]],
    spots: [["Miami", "United States", "Ocean Drive Ink", "America/New_York", 28, 33, "booking"], ["Mexico City", "Mexico", "Arana Negro", "America/Mexico_City", 70, 75, "announced"]],
  },
];

export async function seedWorld(db: Db) {
  for (const a of ARTISTS) {
    const home = placeCity(a.city, a.country);
    const studio = await db.one<{ id: string }>(`insert into studios (slug, name, kind, plan, subscription_status) values ($1, $2, 'solo', $3, 'active') returning id`, [a.slug + "-studio", a.studio, a.plan]);
    const s = studio!.id;
    const artist = await db.one<{ id: string }>(
      `insert into artists (studio_id, slug, display_name, headline, bio, instagram, home_city, country, city_slug, lat, lng, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, accepting, trade, booking_mode)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'usd', $14, $15, $16, $17, $18, 'tattoo', 'brief_quote') returning id`,
      [s, a.slug, a.name, a.headline, a.bio, a.instagram, a.city, a.country, home.city_slug, home.lat, home.lng, a.styles, a.priceFrom, a.word, a.quote, a.since, a.accent, a.accepting ?? true],
    );
    const id = artist!.id;
    await db.query(
      `insert into tour_stops (studio_id, artist_id, city, country, city_slug, lat, lng, studio_name, timezone, status, is_home) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'booking', true)`,
      [s, id, a.city, a.country, home.city_slug, home.lat, home.lng, a.studio, a.tz],
    );
    for (const [city, country, studioName, tz, start, end, status] of a.spots ?? []) {
      const p = placeCity(city, country);
      await db.query(
        `insert into tour_stops (studio_id, artist_id, city, country, city_slug, lat, lng, studio_name, timezone, starts_on, ends_on, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [s, id, city, country, p.city_slug, p.lat, p.lng, studioName, tz, dateOnly(start), dateOnly(end), status],
      );
    }
    for (const [i, [title, style, color, placement, healed, story]] of a.pieces.entries()) {
      await db.query(
        `insert into portfolio_items (studio_id, artist_id, image_path, title, style, color_mode, placement, is_healed, sort, featured, story, published_at)
         values ($1, $2, null, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [s, id, title, style, color, placement, healed, i, story !== null, story, new Date(Date.now() - (3 + i * 9) * DAY).toISOString()],
      );
    }
  }

  // Geo for the first two artists and their stops (seeded before this file existed).
  const artists = await db.query<{ id: string; home_city: string | null; country: string | null }>(`select id, home_city, country from artists where city_slug is null and home_city is not null`);
  for (const r of artists) {
    const p = placeCity(r.home_city!, r.country ?? (r.home_city === "New York" ? "United States" : null));
    await db.query(`update artists set city_slug = $2, lat = $3, lng = $4, country = coalesce(country, $5) where id = $1`, [r.id, p.city_slug, p.lat, p.lng, p.country]);
  }
  const stops = await db.query<{ id: string; city: string; country: string }>(`select id, city, country from tour_stops where city_slug is null`);
  for (const r of stops) {
    const p = placeCity(r.city, r.country);
    await db.query(`update tour_stops set city_slug = $2, lat = $3, lng = $4 where id = $1`, [r.id, p.city_slug, p.lat, p.lng]);
  }

  // Daniel Reyes has an account: his brief and quote with Camo are his, he follows three artists and a city.
  await db.query(`insert into client_users (user_id, email, name, locale, home_city, city_slug) values ($1, $2, 'Daniel Reyes', 'es', 'New York', 'new-york') on conflict do nothing`, [DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL]);
  await db.query(`update clients set user_id = $1 where lower(email) = lower($2)`, [DEMO_CLIENT_USER_ID, DEMO_CLIENT_EMAIL]);
  await db.query(`insert into follows (user_id, artist_id) select $1, id from artists where slug in ('camo', 'elena-sanz', 'kenji-okada') on conflict do nothing`, [DEMO_CLIENT_USER_ID]);
  await db.query(`insert into saves (user_id, portfolio_item_id) select $1, id from portfolio_items where title in ('Saint Sebastian', 'Grandfather at the harbour') on conflict do nothing`, [DEMO_CLIENT_USER_ID]);
  await db.query(`insert into city_follows (user_id, city_slug, trade) values ($1, 'miami', 'tattoo') on conflict do nothing`, [DEMO_CLIENT_USER_ID]);
}
