/**
 * Demo studio for the local database: one artist with a home studio and two
 * guest spots, and one request in every stage of the pipeline. Only runs when
 * the embedded database is created for the first time.
 */
import fs from "node:fs";
import path from "node:path";

import { DEMO_USER_ID } from "./env";
import type { Db } from "./db";
import { putFile } from "./storage";

const day = 24 * 3600 * 1000;

function at(daysFromNow: number, hour: number, minute = 0) {
  // Local wall time in New York, expressed in UTC (good enough for demo data: EST/EDT offset 4–5h).
  const d = new Date(Date.now() + daysFromNow * day);
  d.setUTCHours(hour + 5, minute, 0, 0);
  return d.toISOString();
}

const dateOnly = (daysFromNow: number) => new Date(Date.now() + daysFromNow * day).toISOString().slice(0, 10);

export async function seedDemo(db: Db) {
  const studio = await db.one<{ id: string }>(`insert into studios (slug, name, kind, plan, subscription_status) values ('iris-calderon', 'Iris Calderón Tattoo', 'solo', 'founding', 'active') returning id`);
  const s = studio!.id;
  // The demo cover is a render of the same statue clients place their tattoo on.
  const coverSrc = path.join(process.cwd(), "public", "demo", "iris-cover.jpg");
  let portrait: string | null = null;
  if (fs.existsSync(coverSrc)) {
    portrait = "demo/iris-cover.jpg";
    await putFile("public", portrait, fs.readFileSync(coverSrc), "image/jpeg").catch(() => (portrait = null));
  }
  const artist = await db.one<{ id: string }>(
    `insert into artists (studio_id, slug, display_name, headline, bio, instagram, home_city, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, portrait_path)
     values ($1, 'iris', 'Iris Calderón',
       'Black & grey realism and surreal portraits',
       'I tattoo in New York and travel to Europe twice a year. Most of my work is large-scale realism: portraits, sculpture, nature and dreamlike compositions built around the body.',
       'iris.calderon.ink', 'New York', '{realism,surrealism,illustrative}', 30000, 'usd',
       'REALISM', 'Skin remembers what the eye forgets.', 2016, '#d8552f', $2)
     returning id`,
    [s, portrait],
  );
  const a = artist!.id;
  await db.query(`insert into members (studio_id, user_id, email, role, locale, artist_id) values ($1, $2, 'demo@brief.local', 'owner', 'es', $3)`, [s, DEMO_USER_ID, a]);

  const stop = async (city: string, country: string, studio: string, address: string, tz: string, start: string | null, end: string | null, status: string, home = false) =>
    (await db.one<{ id: string }>(
      `insert into tour_stops (studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, status, is_home)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [s, a, city, country, studio, address, tz, start, end, status, home],
    ))!.id;
  const ny = await stop("New York", "United States", "Nocturne Studio", "214 Bowery, New York, NY", "America/New_York", null, null, "booking", true);
  const london = await stop("London", "United Kingdom", "Saint Ink", "41 Hackney Rd, London", "Europe/London", dateOnly(120), dateOnly(131), "booking");
  const milan = await stop("Milan", "Italy", "Officina Nera", "Via Tortona 12, Milano", "Europe/Rome", dateOnly(136), dateOnly(142), "announced");

  const portfolio: [string, string, string, string, boolean][] = [
    ["Grandmother & pocket watch", "realism", "black_grey", "forearm_inner_L", true],
    ["Marble Medusa", "realism", "black_grey", "upper_arm_R", true],
    ["Clockwork moth", "surrealism", "black_grey", "back_upper", false],
    ["Drowned cathedral", "surrealism", "color", "thigh_L", true],
    ["Lion & laurel", "realism", "black_grey", "chest_full", false],
    ["Hands of the sculptor", "illustrative", "black_grey", "calf_R", true],
  ];
  for (const [i, [title, style, color, placement, healed]] of portfolio.entries()) {
    await db.query(
      `insert into portfolio_items (studio_id, artist_id, image_path, title, style, color_mode, placement, is_healed, sort) values ($1, $2, null, $3, $4, $5, $6, $7, $8)`,
      [s, a, title, style, color, placement, healed, i],
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

  await db.query(`insert into waitlist (studio_id, artist_id, tour_stop_id, city, email, name) values ($1, $2, $3, 'Milan', 'giulia@example.com', 'Giulia'), ($1, $2, $3, 'Milan', 'marco@example.com', 'Marco')`, [s, a, milan]);
  // Cities the public is asking for, no stop planned yet.
  const asks: [string, number][] = [["Miami", 14], ["Los Angeles", 9], ["Mexico City", 7], ["Madrid", 5], ["Santiago", 4], ["Toronto", 2]];
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
