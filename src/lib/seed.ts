/**
 * Demo studio for the local database: one artist with a home studio and two
 * guest spots, and one request in every stage of the pipeline. Only runs when
 * the embedded database is created for the first time.
 */

import { DEMO_USER_ID } from "./env";
import type { Db } from "./db";

const DAY = 24 * 3600 * 1000;
const day = DAY;

function at(daysFromNow: number, hour: number, minute = 0) {
  // Local wall time in New York, expressed in UTC (good enough for demo data: EST/EDT offset 4–5h).
  const d = new Date(Date.now() + daysFromNow * day);
  d.setUTCHours(hour + 5, minute, 0, 0);
  return d.toISOString();
}

const dateOnly = (daysFromNow: number) => new Date(Date.now() + daysFromNow * day).toISOString().slice(0, 10);

export async function seedDemo(db: Db) {
  const studio = await db.one<{ id: string }>(`insert into studios (slug, name, kind, plan, subscription_status) values ('soulmate-tattoo', 'Soulmate Tattoo', 'solo', 'founding', 'active') returning id`);
  const s = studio!.id;
  // Demo images stay in public/demo and are served statically; the key only has to point there.
  const demoImage = (file: string) => `demo/${file}`;
  // Camo Contreras, Soulmate Tattoo: the first artist on the platform. His cover is his own poster.
  const camoCover = demoImage("camo-cover.webp");
  const artist = await db.one<{ id: string }>(
    `insert into artists (studio_id, slug, display_name, headline, bio, instagram, home_city, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, cover_poster, portrait_path)
     values ($1, 'camo', 'Camo Contreras',
       'Realism & surrealism · colour and black & grey',
       'Soulmate Tattoo. Large-scale realism and surreal compositions built around the body: portraits, sculpture, nature and the dreamlike, in colour or in black and grey.

Based in New York, with guest spots in Europe every year. Every piece starts with a conversation: where it goes, how big it lives on you, and what it has to carry.',
       'soulmate.tattoo', 'New York', '{realism,surrealism,illustrative}', 30000, 'usd',
       'SOULMATE', 'Skin remembers what the eye forgets.', 2016, '#e34b36', true, $2)
     returning id`,
    [s, camoCover],
  );
  const a = artist!.id;
  await db.query(`insert into members (studio_id, user_id, email, role, locale, artist_id) values ($1, $2, 'demo@brief.local', 'owner', 'es', $3)`, [s, DEMO_USER_ID, a]);

  // A second artist so Explore has a neighbour: a studio of her own, no member. Her cover is a render of the statue.
  const iris = await db.one<{ id: string }>(`insert into studios (slug, name, kind, plan, subscription_status) values ('iris-calderon', 'Iris Calderón Tattoo', 'solo', 'founding', 'active') returning id`);
  const irisCover = demoImage("iris-cover.jpg");
  const irisArtist = await db.one<{ id: string }>(
    `insert into artists (studio_id, slug, display_name, headline, bio, instagram, home_city, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, portrait_path)
     values ($1, 'iris', 'Iris Calderón', 'Black & grey realism and surreal portraits',
       'I tattoo in New York and travel to Europe twice a year. Most of my work is large-scale realism: portraits, sculpture, nature and dreamlike compositions built around the body.',
       'iris.calderon.ink', 'New York', '{realism,surrealism,illustrative}', 30000, 'usd', 'REALISM', 'Marble first, then skin.', 2018, '#d8552f', $2) returning id`,
    [iris!.id, irisCover],
  );
  await db.query(`insert into tour_stops (studio_id, artist_id, city, country, studio_name, timezone, status, is_home) values ($1, $2, 'New York', 'United States', 'Nocturne Studio', 'America/New_York', 'booking', true)`, [iris!.id, irisArtist!.id]);
  for (const [i, title] of ["Marble Medusa", "Clockwork moth", "Hands of the sculptor"].entries()) {
    await db.query(`insert into portfolio_items (studio_id, artist_id, image_path, title, style, color_mode, sort) values ($1, $2, null, $3, 'realism', 'black_grey', $4)`, [iris!.id, irisArtist!.id, title, i]);
  }

  const stop = async (city: string, country: string, studio: string, address: string, tz: string, start: string | null, end: string | null, status: string, home = false) =>
    (await db.one<{ id: string }>(
      `insert into tour_stops (studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, status, is_home)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [s, a, city, country, studio, address, tz, start, end, status, home],
    ))!.id;
  // Home, then a US leg over the next two months, then Europe: the map frames the leg.
  const ny = await stop("New York", "United States", "Soulmate Tattoo", "Brooklyn, NY", "America/New_York", null, null, "booking", true);
  const miami = await stop("Miami", "United States", "Ocean Drive Ink", "1200 Collins Ave, Miami Beach, FL", "America/New_York", dateOnly(18), dateOnly(24), "booking");
  const la = await stop("Los Angeles", "United States", "Golden Hour Tattoo", "7510 Melrose Ave, Los Angeles, CA", "America/Los_Angeles", dateOnly(31), dateOnly(37), "booking");
  const austin = await stop("Austin", "United States", "Red River Social", "604 E 6th St, Austin, TX", "America/Chicago", dateOnly(45), dateOnly(50), "announced");
  const london = await stop("London", "United Kingdom", "Saint Ink", "41 Hackney Rd, London", "Europe/London", dateOnly(120), dateOnly(131), "booking");

  const portfolio: [string, string, string, string, boolean, string | null][] = [
    ["Grandmother & pocket watch", "realism", "black_grey", "forearm_inner_L", true, "A portrait from a 1962 photograph, the watch she wore to work for forty years. Two sessions, inner forearm, so it faces him when he reads."],
    ["Marble Medusa", "realism", "black_grey", "upper_arm_R", true, "Bernini by way of Brooklyn. The stone had to look cold and the snakes had to look alive, so the greys are split in two palettes. One long session, healed in three weeks."],
    ["Clockwork moth", "surrealism", "black_grey", "back_upper", false, null],
    ["Drowned cathedral", "surrealism", "color", "thigh_L", true, "A cathedral under water, light coming down through the nave. The first piece in colour for a client who had only worn black and grey. Three sessions over a winter."],
    ["Lion & laurel", "realism", "black_grey", "chest_full", false, null],
    ["Hands of the sculptor", "illustrative", "black_grey", "calf_R", true, null],
  ];
  for (const [i, [title, style, color, placement, healed, story]] of portfolio.entries()) {
    await db.query(
      `insert into portfolio_items (studio_id, artist_id, image_path, title, style, color_mode, placement, is_healed, sort, featured, story) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [s, a, demoImage(`tattoo-${String(i + 1).padStart(2, "0")}.webp`), title, style, color, placement, healed, i, story !== null, story],
    );
  }

  const flash: [string, string, string, number, string, boolean][] = [
    ["Medusa, marble", "Bust in profile, hair of serpents carved like stone. One session.", "14 × 20 cm", 90000, "available", false],
    ["Moth & pocket watch", "A clockwork moth resting on an open watch, fine shading.", "10 × 14 cm", 60000, "available", true],
    ["Saint hands", "Praying hands bound with a rosary, soft black and grey.", "12 × 16 cm", 70000, "reserved", false],
    ["Drowned cathedral", "Gothic arches sinking into still water, light from above.", "20 × 30 cm", 160000, "available", false],
    ["Crow with laurel", "Standing crow, laurel in the beak, high contrast.", "11 × 12 cm", 55000, "taken", false],
    ["Eye of the sculptor", "A single carved eye with a falling tear of marble dust.", "8 × 8 cm", 40000, "available", true],
  ];
  for (const [i, [title, description, size, price, status, repeatable]] of flash.entries()) {
    await db.query(
      `insert into flash_designs (studio_id, artist_id, image_path, title, description, size_label, price_cents, currency, status, repeatable, sort) values ($1, $2, null, $3, $4, $5, $6, 'usd', $7, $8, $9)`,
      [s, a, title, description, size, price, status, repeatable, i],
    );
  }

  await db.query(`insert into waitlist (studio_id, artist_id, tour_stop_id, city, email, name) values ($1, $2, $3, 'Austin', 'giulia@example.com', 'Giulia'), ($1, $2, $3, 'Austin', 'marco@example.com', 'Marco')`, [s, a, austin]);
  // Cities the public is asking for, no stop planned yet.
  const asks: [string, number][] = [["Mexico City", 7], ["Madrid", 5], ["Chicago", 4], ["Santiago", 4], ["Toronto", 2], ["Berlin", 2]];
  for (const [city, n] of asks) {
    for (let i = 0; i < n; i++) {
      await db.query(`insert into waitlist (studio_id, artist_id, tour_stop_id, city, email) values ($1, $2, null, $3, $4)`, [s, a, city, `${city.toLowerCase().replace(/\s+/g, "")}${i}@example.com`]);
    }
  }

  const client = async (name: string, email: string, locale: string, instagram: string | null) =>
    (await db.one<{ id: string }>(`insert into clients (studio_id, name, email, locale, instagram) values ($1, $2, $3, $4, $5) returning id`, [s, name, email, locale, instagram]))!.id;

  type BriefSeed = {
    client: string;
    ref: string;
    status: string;
    style: string;
    color: string;
    placement: string;
    full?: boolean;
    body: "f" | "m";
    height: number;
    w?: number;
    h?: number;
    description: string;
    avoid?: string;
    budget: [number, number | null];
    timing: string;
    dates?: string;
    stop: string | null;
    daysAgo: number;
    first?: boolean;
    coverup?: boolean;
    source?: Record<string, string>;
  };
  const brief = async (b: BriefSeed) => {
    const created = new Date(Date.now() - b.daysAgo * day).toISOString();
    const row = await db.one<{ id: string }>(
      `insert into briefs (studio_id, artist_id, client_id, ref, status, style, color_mode, placement, full_coverage, body, body_height_cm, size_w_cm, size_h_cm,
          description, avoid, is_first_tattoo, is_coverup, budget_min_cents, budget_max_cents, timing, preferred_dates, tour_stop_id, attribution, created_at, updated_at, seen_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24, $25) returning id`,
      [
        s, a, b.client, b.ref, b.status, b.style, b.color, b.placement, b.full ?? false, b.body, b.height, b.w ?? null, b.h ?? null,
        b.description, b.avoid ?? null, b.first ?? false, b.coverup ?? false, b.budget[0], b.budget[1], b.timing, b.dates ?? null, b.stop,
        JSON.stringify(b.source ?? {}), created, b.status === "new" && b.daysAgo < 1 ? null : created,
      ],
    );
    await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, created_at) values ($1, $2, 'created', 'client', $3)`, [s, row!.id, created]);
    return row!.id;
  };

  const sofia = await client("Sofía Martínez", "sofia@example.com", "es", "sofi.mtz");
  await brief({
    client: sofia, ref: "B-7KQ4M", status: "new", style: "realism", color: "black_grey", placement: "forearm_inner_L", body: "f", height: 162, w: 11, h: 16,
    description: "Un retrato de mi abuela a los 30 años, basado en la foto de su boda, con el reloj de bolsillo de mi abuelo abierto bajo su rostro. Quiero que se sienta suave, como una foto antigua.",
    avoid: "Nada de flores ni texto. No quiero que se vea oscuro o triste.",
    budget: [60000, 100000], timing: "flexible", stop: ny, daysAgo: 0.2, source: { utm_source: "instagram", utm_medium: "bio" },
  });
  const jordan = await client("Jordan Lee", "jordan@example.com", "en", "jordanlee");
  await brief({
    client: jordan, ref: "B-3HX9P", status: "new", style: "surrealism", color: "color", placement: "back_upper", body: "m", height: 183, w: 30, h: 24,
    description: "A melting clock draped over a marble bust, with a flock of birds turning into sheet music as they fly toward the shoulder blades. Muted colour, mostly ochre and teal.",
    budget: [200000, 400000], timing: "specific", dates: "Any day while you're in London", stop: london, daysAgo: 1.4, source: { utm_source: "meta", utm_campaign: "london-guest-spot" },
  });
  const amara = await client("Amara Okafor", "amara@example.com", "en", null);
  const amaraBrief = await brief({
    client: amara, ref: "B-9TC2W", status: "needs_info", style: "fine_line", color: "black_grey", placement: "ribs_L", body: "f", height: 170, w: 8, h: 14, first: true,
    description: "A small botanical piece with my mother's birth flower, the line work very delicate.",
    budget: [20000, 50000], timing: "asap", stop: ny, daysAgo: 3,
  });
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, created_at) values ($1, $2, 'info_requested', 'artist', $3, $4)`, [
    s, amaraBrief, "Hi Amara! Which flower is it? If you have a photo of the real flower, send it over so I can draw it from life.", new Date(Date.now() - 2 * day).toISOString(),
  ]);

  const daniel = await client("Daniel Reyes", "daniel@example.com", "es", "dreyes");
  const danielBrief = await brief({
    client: daniel, ref: "B-5NV8R", status: "quoted", style: "realism", color: "black_grey", placement: "sleeve_full_R", full: true, body: "m", height: 176,
    description: "Manga completa de escultura clásica: el David de Miguel Ángel, columnas en ruinas y nubes. Quiero que fluya del hombro a la muñeca.",
    avoid: "Sin color. Nada de rosas.",
    budget: [400000, null], timing: "flexible", stop: ny, daysAgo: 6, source: { utm_source: "google" },
  });
  const quote = await db.one<{ id: string }>(
    `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, price_max_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at, status, created_at)
     values ($1, $2, $3, 'demo-quote-daniel-reyes-0001x', 450000, 520000, 5, 6, 50000, 'usd', $4, $5, $6, 'viewed', $7) returning id`,
    [
      s, danielBrief, a,
      "Daniel, me encanta la idea. La haría en 5 sesiones de unas 6 horas, empezando por el hombro. Te dejo tres fechas para la primera sesión.",
      JSON.stringify({ refundable: false, reschedule_notice_hours: 72, reschedules_allowed: 1, applies_to_final_price: true }),
      new Date(Date.now() + 9 * day).toISOString(), new Date(Date.now() - 5 * day).toISOString(),
    ],
  );
  for (const [d, h] of [[9, 11], [12, 12], [16, 11]] as const) {
    await db.query(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id) values ($1, $2, $3, $4, 'America/New_York', $5)`, [
      s, quote!.id, at(d, h), at(d, h + 6), ny,
    ]);
  }
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, data, created_at) values ($1, $2, 'quoted', 'artist', $3, $4)`, [
    s, danielBrief, JSON.stringify({ quote_id: quote!.id }), new Date(Date.now() - 5 * day).toISOString(),
  ]);

  const chloe = await client("Chloé Martin", "chloe@example.com", "en", "chloe.mrtn");
  const chloeBrief = await brief({
    client: chloe, ref: "B-2PL6J", status: "booked", style: "surrealism", color: "color", placement: "thigh_L", body: "f", height: 168, w: 14, h: 20,
    description: "A whale swimming through a night sky full of lanterns, deep blues with warm gold lights.",
    budget: [100000, 200000], timing: "flexible", stop: ny, daysAgo: 12,
  });
  const chloeQuote = await db.one<{ id: string }>(
    `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, price_max_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at, status, created_at)
     values ($1, $2, $3, 'demo-quote-chloe-martin-0002x', 140000, null, 1, 7, 30000, 'usd', 'See you soon, Chloé!', $4, $5, 'paid', $6) returning id`,
    [s, chloeBrief, a, JSON.stringify({ refundable: false, reschedule_notice_hours: 72, reschedules_allowed: 1, applies_to_final_price: true }), new Date(Date.now() + 2 * day).toISOString(), new Date(Date.now() - 10 * day).toISOString()],
  );
  const slot = await db.one<{ id: string }>(
    `insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id, status) values ($1, $2, $3, $4, 'America/New_York', $5, 'booked') returning id`,
    [s, chloeQuote!.id, at(6, 13), at(6, 20), ny],
  );
  const appt = await db.one<{ id: string }>(
    `insert into appointments (studio_id, artist_id, client_id, brief_id, quote_id, slot_id, starts_at, ends_at, timezone, city) values ($1, $2, $3, $4, $5, $6, $7, $8, 'America/New_York', 'New York') returning id`,
    [s, a, chloe, chloeBrief, chloeQuote!.id, slot!.id, at(6, 13), at(6, 20)],
  );
  await db.query(`insert into payments (studio_id, quote_id, appointment_id, provider, checkout_id, amount_cents, currency, status) values ($1, $2, $3, 'demo', 'demo_seed_chloe', 30000, 'usd', 'paid')`, [
    s, chloeQuote!.id, appt!.id,
  ]);
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, data, created_at) values ($1, $2, 'paid', 'client', $3, $4)`, [
    s, chloeBrief, JSON.stringify({ amount_cents: 30000, currency: "usd" }), new Date(Date.now() - 9 * day).toISOString(),
  ]);

  // Sessions already booked on the road, so the guest-spot calendars show taken days.
  const booked = async (who: string, email: string, ref: string, placement: string, description: string, stopId: string, city: string, tz: string, day: number, hour: number, hours: number, token: string) => {
    const c = await client(who, email, "en", null);
    const b = await brief({ client: c, ref, status: "booked", style: "realism", color: "black_grey", placement, body: "f", height: 170, w: 12, h: 18, description, budget: [100000, 200000], timing: "specific", stop: stopId, daysAgo: 14 });
    const q = await db.one<{ id: string }>(
      `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, price_max_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at, status, created_at)
       values ($1, $2, $3, $4, 150000, null, 1, $5, 30000, 'usd', 'See you there!', $6, $7, 'paid', $8) returning id`,
      [s, b, a, token, hours, JSON.stringify({ refundable: false, reschedule_notice_hours: 72, reschedules_allowed: 1, applies_to_final_price: true }), new Date(Date.now() + day * DAY).toISOString(), new Date(Date.now() - 12 * DAY).toISOString()],
    );
    const sl = await db.one<{ id: string }>(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id, status) values ($1, $2, $3, $4, $5, $6, 'booked') returning id`, [
      s, q!.id, at(day, hour), at(day, hour + hours), tz, stopId,
    ]);
    const ap = await db.one<{ id: string }>(
      `insert into appointments (studio_id, artist_id, client_id, brief_id, quote_id, slot_id, starts_at, ends_at, timezone, city) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [s, a, c, b, q!.id, sl!.id, at(day, hour), at(day, hour + hours), tz, city],
    );
    await db.query(`insert into payments (studio_id, quote_id, appointment_id, provider, checkout_id, amount_cents, currency, status) values ($1, $2, $3, 'demo', $4, 30000, 'usd', 'paid')`, [s, q!.id, ap!.id, `demo_seed_${token}`]);
  };
  await booked("Valeria Soto", "valeria@example.com", "B-4MR2K", "forearm_outer_R", "A heron standing in still water, soft black and grey.", miami, "Miami", "America/New_York", 19, 11, 6, "demo-quote-valeria-soto-0003x");
  await booked("Marcus Hill", "marcus@example.com", "B-6QT8N", "calf_L", "Bust of Apollo with a crack of light through the marble.", miami, "Miami", "America/New_York", 21, 12, 7, "demo-quote-marcus-hill-0004x");
  await booked("Lena Park", "lena@example.com", "B-1ZC5V", "shoulder_L", "A moth over a melting candle, fine shading.", la, "Los Angeles", "America/Los_Angeles", 33, 12, 6, "demo-quote-lena-park-0005x");

  const kevin = await client("Kevin Brooks", "kevin@example.com", "en", null);
  const kevinBrief = await brief({
    client: kevin, ref: "B-8WD3F", status: "declined", style: "lettering", color: "black_grey", placement: "hand_R", body: "m", height: 180, w: 6, h: 4,
    description: "My daughter's name in cursive on the side of my hand.",
    budget: [20000, 50000], timing: "asap", stop: ny, daysAgo: 9,
  });
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, created_at) values ($1, $2, 'declined', 'artist', $3, $4)`, [
    s, kevinBrief, "Thanks Kevin! Lettering isn't my speciality, so I'd point you to a script artist for the cleanest result.", new Date(Date.now() - 8 * day).toISOString(),
  ]);
}
