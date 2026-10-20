/**
 * Demo studio for the local database: Camo Contreras, his home studio and the
 * guest spots, and a conversation in every stage of the pipeline, so the demo
 * shows the whole app at once: quotes waiting, an open chat, a session booked
 * on the 21st and the 25th, and one tattoo paid from start to finish.
 *
 * Every id is derived from a name, never random: on Vercel each instance
 * seeds its own database, and the links in a demo (chats, quotes, sessions)
 * have to point at the same rows whichever instance answers.
 * Only runs when the embedded database is created for the first time.
 */

import { createHash } from "node:crypto";

import { dict } from "@/i18n";

import { DEMO_CLIENT_USER_ID, DEMO_EMAIL, DEMO_USER_ID } from "./env";
import { starterDoc, type MagBox } from "./magazine";
import { seedSova } from "./seed-sova";
import { seedHouse, seedWorld } from "./seed-world";
import type { Db } from "./db";

const DAY = 24 * 3600 * 1000;
const day = DAY;

/** A stable uuid from a name (version-5 shaped, sha1 based). */
export function uid(name: string) {
  const h = createHash("sha1").update(`vanta-demo:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** A stable chat token (64 url-safe characters). */
const chatToken = (name: string) => createHash("sha256").update(`vanta-chat:${name}`).digest("hex");

function at(daysFromNow: number, hour: number, minute = 0) {
  // Local wall time in New York, expressed in UTC (good enough for demo data: EST/EDT offset 4–5h).
  const d = new Date(Date.now() + daysFromNow * day);
  d.setUTCHours(hour + 5, minute, 0, 0);
  return d.toISOString();
}

/** The given day of this month (next month once it has passed), at a New York hour. The demo always has its 21st and 25th ahead. */
function onDay(dayOfMonth: number, hour: number, minute = 0) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  if (now.getUTCDate() > dayOfMonth) m += 1;
  if (m > 11) {
    m = 0;
    y += 1;
  }
  const d = new Date(Date.UTC(y, m, dayOfMonth, hour + 5, minute, 0, 0));
  return d.toISOString();
}

const dateOnly = (daysFromNow: number) => new Date(Date.now() + daysFromNow * day).toISOString().slice(0, 10);
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

export async function seedDemo(db: Db, opts: { world?: boolean } = {}) {
  const world = opts.world ?? true;
  const s = uid("studio:soulmate");
  await db.query(`insert into studios (id, slug, name, kind, plan, subscription_status) values ($1, 'soulmate-tattoo', 'Soulmate Tattoo', 'solo', 'founding', 'active')`, [s]);
  // Demo images stay in public/demo and are served statically; the key only has to point there.
  const demoImage = (file: string) => `demo/${file}`;
  // Camo Contreras, Soulmate Tattoo: the first artist on the platform. His cover is his own poster.
  const camoCover = demoImage("camo-cover.webp");
  const a = uid("artist:camo");
  await db.query(
    `insert into artists (id, studio_id, slug, display_name, headline, bio, instagram, home_city, styles, min_price_cents, default_deposit_cents, currency, cover_word, cover_quote, since_year, accent, cover_poster, portrait_path)
     values ($1, $2, 'camo', 'Camo Contreras',
       'Realism & surrealism · colour and black & grey',
       'Soulmate Tattoo. Large-scale realism and surreal compositions built around the body: portraits, sculpture, nature and the dreamlike, in colour or in black and grey.

Based in New York, with guest spots in Europe every year. Every piece starts with a conversation: where it goes, how big it lives on you, and what it has to carry.',
       'soulmate.tattoo', 'New York', '{realism,surrealism,illustrative}', 30000, 10000, 'usd',
       'SOULMATE', 'Skin remembers what the eye forgets.', 2016, '#e34b36', true, $3)`,
    [a, s, camoCover],
  );
  await db.query(`insert into members (studio_id, user_id, email, role, locale, artist_id) values ($1, $2, $4, 'owner', 'es', $3)`, [s, DEMO_USER_ID, a, DEMO_EMAIL]);

  // A second artist so Explore has a neighbour: a studio of her own, no member. Her cover is a render of the statue.
  const irisStudio = uid("studio:iris");
  await db.query(`insert into studios (id, slug, name, kind, plan, subscription_status) values ($1, 'iris-calderon', 'Iris Calderón Tattoo', 'solo', 'founding', 'active')`, [irisStudio]);
  const irisCover = demoImage("iris-cover.jpg");
  const irisArtist = uid("artist:iris");
  await db.query(
    `insert into artists (id, studio_id, slug, display_name, headline, bio, instagram, home_city, styles, min_price_cents, currency, cover_word, cover_quote, since_year, accent, portrait_path)
     values ($1, $2, 'iris', 'Iris Calderón', 'Black & grey realism and surreal portraits',
       'I tattoo in New York and travel to Europe twice a year. Most of my work is large-scale realism: portraits, sculpture, nature and dreamlike compositions built around the body.',
       'iris.calderon.ink', 'New York', '{realism,surrealism,illustrative}', 30000, 'usd', 'REALISM', 'Marble first, then skin.', 2018, '#d8552f', $3)`,
    [irisArtist, irisStudio, irisCover],
  );
  await db.query(`insert into tour_stops (id, studio_id, artist_id, city, country, studio_name, timezone, status, is_home) values ($1, $2, $3, 'New York', 'United States', 'Nocturne Studio', 'America/New_York', 'booking', true)`, [uid("stop:iris:ny"), irisStudio, irisArtist]);
  for (const [i, title] of ["Marble Medusa", "Clockwork moth", "Hands of the sculptor"].entries()) {
    await db.query(`insert into portfolio_items (id, studio_id, artist_id, image_path, title, style, color_mode, sort) values ($1, $2, $3, null, $4, 'realism', 'black_grey', $5)`, [uid(`iris:piece:${i}`), irisStudio, irisArtist, title, i]);
  }

  const stop = async (key: string, city: string, country: string, studio: string, address: string, tz: string, start: string | null, end: string | null, status: string, home = false, cover: string | null = null) => {
    const id = uid(`stop:${key}`);
    await db.query(
      `insert into tour_stops (id, studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, status, is_home, cover_path)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, s, a, city, country, studio, address, tz, start, end, status, home, cover],
    );
    return id;
  };
  // Home, then a US leg over the next two months, then Europe. Each city's calendar wears one of his pieces as its cover (the artist can change it).
  const ny = await stop("ny", "New York", "United States", "Soulmate Tattoo", "Brooklyn, NY", "America/New_York", null, null, "booking", true, demoImage("tattoo-07.webp"));
  const miami = await stop("miami", "Miami", "United States", "Ocean Drive Ink", "1200 Collins Ave, Miami Beach, FL", "America/New_York", dateOnly(18), dateOnly(24), "booking", false, demoImage("tattoo-08.webp"));
  const la = await stop("la", "Los Angeles", "United States", "Golden Hour Tattoo", "7510 Melrose Ave, Los Angeles, CA", "America/Los_Angeles", dateOnly(31), dateOnly(37), "booking", false, demoImage("tattoo-04.webp"));
  const austin = await stop("austin", "Austin", "United States", "Red River Social", "604 E 6th St, Austin, TX", "America/Chicago", dateOnly(45), dateOnly(50), "announced");
  const london = await stop("london", "London", "United Kingdom", "Saint Ink", "41 Hackney Rd, London", "Europe/London", dateOnly(120), dateOnly(131), "booking", false, demoImage("tattoo-02.webp"));

  const portfolio: [string, string, string, string, boolean, string | null][] = [
    ["Grandmother & pocket watch", "realism", "black_grey", "forearm_inner_L", true, "A portrait from a 1962 photograph, the watch she wore to work for forty years. Two sessions, inner forearm, so it faces him when he reads."],
    ["Marble Medusa", "realism", "black_grey", "upper_arm_R", true, "Bernini by way of Brooklyn. The stone had to look cold and the snakes had to look alive, so the greys are split in two palettes. One long session, healed in three weeks."],
    ["Clockwork moth", "surrealism", "black_grey", "back_upper", false, null],
    ["Drowned cathedral", "surrealism", "color", "thigh_L", true, "A cathedral under water, light coming down through the nave. The first piece in colour for a client who had only worn black and grey. Three sessions over a winter."],
    ["Lion & laurel", "realism", "black_grey", "chest_full", false, null],
    ["Hands of the sculptor", "illustrative", "black_grey", "calf_R", true, null],
    ["Saint Sebastian", "realism", "black_grey", "back_full", true, "Arrows and bound hands from a Renaissance panel, scaled to the whole back. Four sessions over a summer, the longest piece in the book."],
    ["Koi under ice", "surrealism", "color", "forearm_outer_R", true, null],
    ["The astronomer's eye", "surrealism", "black_grey", "chest_center", false, "A single eye, a sextant and the night sky folded into one composition on the sternum. One session, no colour."],
    ["Wolf & moon", "realism", "black_grey", "shoulder_R", true, null],
    ["Paper boats on the Hudson", "illustrative", "black_grey", "ribs_L", true, null],
    ["Blooming skull", "illustrative", "color", "thigh_R", false, "A skull overgrown with peonies, drawn for a florist. Colour kept to the petals so the bone stays bone."],
  ];
  for (const [i, [title, style, color, placement, healed, story]] of portfolio.entries()) {
    await db.query(
      `insert into portfolio_items (id, studio_id, artist_id, image_path, title, style, color_mode, placement, is_healed, sort, featured, story) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [uid(`piece:${i}`), s, a, demoImage(`tattoo-${String(i + 1).padStart(2, "0")}.webp`), title, style, color, placement, healed, i, story !== null, story],
    );
  }

  // His magazine, finished: the starter layout with his photographs, every text box saying what goes there, so the demo reads as a whole issue.
  const guide: Record<string, string[]> = {
    kicker: ["El artista", "Próximas fechas"],
    title: ["Camo Contreras", "Serie: retratos", "Realismo"],
    bio: ["Aquí va la biografía del artista: de dónde viene, cómo empezó y qué lo mueve a tatuar. Cada texto de la revista se edita tocándolo."],
    quote: ["Aquí puede ir una frase tuya que defina tu trabajo.", "«Una frase tuya, en tu propia letra.»"],
    caption: [
      "Aquí va la descripción de la foto: el nombre de la pieza, en qué parte del cuerpo va y cuántas sesiones tomó.",
      "Aquí puedes contar la historia detrás de estas dos piezas, o dejar un texto sobre tu estilo.",
      "Texto al costado: técnica, tiempo de curación, zona del cuerpo.",
      "Una hoja de contactos: cuatro piezas y una línea sobre cada una.",
      "El pie de foto va aquí.",
      "Aquí puedes anunciar tus próximas ciudades o explicar cómo reservar contigo.",
    ],
    coverLine: ["Skin remembers what the eye forgets."],
  };
  const used: Record<string, number> = {};
  const fillBoxes = (boxes: MagBox[]) =>
    boxes.map((b) => {
      if (b.kind !== "text" || !b.ph) return b;
      const list = guide[b.ph] ?? [];
      const k = used[b.ph] ?? 0;
      used[b.ph] = k + 1;
      return { ...b, text: list[Math.min(k, list.length - 1)] ?? "" };
    });
  const mag = starterDoc(portfolio.map((_, i) => demoImage(`tattoo-${String(i + 1).padStart(2, "0")}.webp`)), camoCover, camoCover);
  mag.cover.boxes = fillBoxes(mag.cover.boxes);
  mag.pages = mag.pages.map((p) => ({ ...p, boxes: fillBoxes(p.boxes) }));
  await db.query(`update artists set magazine = $1 where id = $2`, [JSON.stringify(mag), a]);

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
      `insert into flash_designs (id, studio_id, artist_id, image_path, title, description, size_label, price_cents, currency, status, repeatable, sort) values ($1, $2, $3, null, $4, $5, $6, $7, 'usd', $8, $9, $10)`,
      [uid(`flash:${i}`), s, a, title, description, size, price, status, repeatable, i],
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

  /* ------------------------------------------------------------ the chats */

  const client = async (key: string, name: string, email: string, locale: string, instagram: string | null, userId: string | null = null) => {
    const id = uid(`client:${key}`);
    await db.query(`insert into clients (id, studio_id, name, email, locale, instagram, user_id) values ($1, $2, $3, $4, $5, $6, $7)`, [id, s, name, email, locale, instagram, userId]);
    return id;
  };

  type BriefSeed = {
    key: string;
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
    /** When the client wrote; an ISO string or days ago. */
    created: string | number;
    first?: boolean;
    coverup?: boolean;
    source?: Record<string, string>;
    /** The client's reference photos: the artist's own pieces stand in for them in the demo. */
    refs?: number[];
  };
  const brief = async (b: BriefSeed) => {
    const id = uid(`brief:${b.key}`);
    const created = typeof b.created === "number" ? ago(b.created) : b.created;
    await db.query(
      `insert into briefs (id, studio_id, artist_id, client_id, ref, status, style, color_mode, placement, full_coverage, body, body_height_cm, size_w_cm, size_h_cm,
          description, avoid, is_first_tattoo, is_coverup, budget_min_cents, budget_max_cents, timing, preferred_dates, tour_stop_id, attribution, created_at, updated_at, seen_at, chat_token)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $25, $26, $27)`,
      [
        id, s, a, b.client, b.ref, b.status, b.style, b.color, b.placement, b.full ?? false, b.body, b.height, b.w ?? null, b.h ?? null,
        b.description, b.avoid ?? null, b.first ?? false, b.coverup ?? false, b.budget[0], b.budget[1], b.timing, b.dates ?? null, b.stop,
        JSON.stringify(b.source ?? {}), created, b.status === "new" ? null : created, chatToken(b.key),
      ],
    );
    await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, created_at) values ($1, $2, 'created', 'client', $3)`, [s, id, created]);
    for (const [i, n] of (b.refs ?? []).entries()) {
      await db.query(`insert into brief_files (id, studio_id, brief_id, kind, path, mime, bytes, created_at) values ($1, $2, $3, 'reference', $4, 'image/webp', 1, $5)`, [
        uid(`file:${b.key}:${i}`), s, id, demoImage(`tattoo-${String(n).padStart(2, "0")}.webp`), created,
      ]);
    }
    return id;
  };
  const say = (briefId: string, actor: "artist" | "client", body: string, when: string, data: Record<string, unknown> = {}) =>
    db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data, created_at) values ($1, $2, 'message', $3, $4, $5, $6)`, [s, briefId, actor, body, JSON.stringify(data), when]);
  const care = dict("es").care;
  const careSheet = (briefId: string, stage: "pre" | "post", when: string) =>
    say(briefId, "artist", `${stage === "pre" ? care.preTitle : care.postTitle}\n\n${stage === "pre" ? care.preDefault : care.postDefault}`, when, { care: stage });
  /** The four lines of every booking in the demo: hello, how much, here it comes, thank you. */
  const lines = (locale: "es" | "en", name: string) =>
    locale === "es"
      ? {
          hello: `¡Hola ${name}! ¿Qué tal? Está muy buena la idea.`,
          howMuch: "¡Sí, gracias! ¿Cuánto saldría el proyecto?",
          evaluating: "Estoy evaluando tu cotización. Te mando aquí la respuesta con el monto de reservación y el monto total del tatuaje.",
          thanks: "¡Muchas gracias por tu reservación! Nos vemos el día de nuestra sesión.",
        }
      : {
          hello: `Hi ${name}! How are you? I love the idea.`,
          howMuch: "Yes, thank you! How much would the project be?",
          evaluating: "I'm evaluating your quote. I'll send the answer here with the booking amount and the tattoo's total.",
          thanks: "Thank you for your booking! See you on the day of our session.",
        };
  const policy = JSON.stringify({ refundable: false, reschedule_notice_hours: 72, reschedules_allowed: 1, applies_to_final_price: true });

  /**
   * The artist's quote as the app sends it: a total for the session, the $100
   * deposit that books it, the date. Paid: the session is in the calendar,
   * the deposit in the books; finished: the balance was asked and paid too.
   */
  const quote = async (o: { key: string; brief: string; client: string; name: string; locale: "es" | "en"; stopId: string; city: string; tz: string; starts: string; hours: number; total: number; deposit?: number; message: string; sent: string; paid?: string; finished?: string; balancePaid?: string }) => {
    const q = uid(`quote:${o.key}`);
    const deposit = o.deposit ?? 10000;
    const status = o.paid ? "paid" : "viewed";
    const L = lines(o.locale, o.name.split(" ")[0]);
    const sentAt = new Date(o.sent).getTime();
    await say(o.brief, "artist", L.hello, new Date(sentAt - 3 * 3600_000).toISOString());
    await say(o.brief, "client", L.howMuch, new Date(sentAt - 2 * 3600_000).toISOString());
    await say(o.brief, "artist", L.evaluating, new Date(sentAt - 3600_000).toISOString());
    await db.query(
      `insert into quotes (id, studio_id, brief_id, artist_id, token, price_min_cents, price_max_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at, status, created_at)
       values ($1, $2, $3, $4, $5, $6, null, 1, $7, $8, 'usd', $9, $10, $11, $12, $13)`,
      [q, s, o.brief, a, `demo-quote-${o.key}-${chatToken(o.key).slice(0, 12)}`, o.total, o.hours, deposit, o.message, policy, new Date(new Date(o.starts).getTime()).toISOString(), status, o.sent],
    );
    const ends = new Date(new Date(o.starts).getTime() + o.hours * 3600_000).toISOString();
    const slot = uid(`slot:${o.key}`);
    await db.query(`insert into quote_slots (id, studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id, status) values ($1, $2, $3, $4, $5, $6, $7, $8)`, [slot, s, q, o.starts, ends, o.tz, o.stopId, o.paid ? "booked" : "offered"]);
    await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data, created_at) values ($1, $2, 'offer', 'artist', $3, $4, $5)`, [s, o.brief, o.message, JSON.stringify({ quote_id: q }), o.sent]);
    if (!o.paid) return q;
    const ap = uid(`appointment:${o.key}`);
    await db.query(
      `insert into appointments (id, studio_id, artist_id, client_id, brief_id, quote_id, slot_id, starts_at, ends_at, timezone, city, status, balance_cents, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [ap, s, a, o.client, o.brief, q, slot, o.starts, ends, o.tz, o.city, o.balancePaid ? "completed" : "confirmed", o.total - deposit, o.paid],
    );
    await db.query(`insert into payments (id, studio_id, quote_id, appointment_id, provider, checkout_id, amount_cents, currency, status, kind, created_at) values ($1, $2, $3, $4, 'demo', $5, $6, 'usd', 'paid', 'deposit', $7)`, [
      uid(`payment:deposit:${o.key}`), s, q, ap, `demo_seed_deposit_${o.key}`, deposit, o.paid,
    ]);
    await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, data, created_at) values ($1, $2, 'paid', 'client', $3, $4)`, [s, o.brief, JSON.stringify({ amount_cents: deposit, currency: "usd", appointment_id: ap }), o.paid]);
    await say(o.brief, "artist", L.thanks, new Date(new Date(o.paid).getTime() + 30 * 60_000).toISOString());
    await careSheet(o.brief, "pre", new Date(new Date(o.paid).getTime() + 60_000).toISOString());
    if (o.finished) await say(o.brief, "artist", dict("es").chat.balance.request.replace("{amount}", `$${((o.total - deposit) / 100).toLocaleString("en-US")}`), o.finished);
    if (o.balancePaid) {
      await db.query(`insert into payments (id, studio_id, quote_id, appointment_id, provider, checkout_id, amount_cents, currency, status, kind, created_at) values ($1, $2, $3, $4, 'demo', $5, $6, 'usd', 'paid', 'balance', $7)`, [
        uid(`payment:balance:${o.key}`), s, q, ap, `demo_seed_balance_${o.key}`, o.total - deposit, o.balancePaid,
      ]);
      await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, data, created_at) values ($1, $2, 'balance_paid', 'client', $3, $4)`, [s, o.brief, JSON.stringify({ amount_cents: o.total - deposit, currency: "usd", appointment_id: ap }), o.balancePaid]);
      await careSheet(o.brief, "post", new Date(new Date(o.balancePaid).getTime() + 60_000).toISOString());
    }
    return q;
  };

  // 1 · Sofía: a quote waiting for the artist, photos attached, no date yet. The one to run from zero in the demo.
  const sofia = await client("sofia", "Sofía Martínez", "sofia@example.com", "es", "sofi.mtz");
  await brief({
    key: "sofia", client: sofia, ref: "B-7KQ4M", status: "new", style: "realism", color: "black_grey", placement: "forearm_inner_L", body: "f", height: 162, w: 11, h: 16,
    description: "Un retrato de mi abuela a los 30 años, basado en la foto de su boda, con el reloj de bolsillo de mi abuelo abierto bajo su rostro. Quiero que se sienta suave, como una foto antigua.",
    avoid: "Nada de flores ni texto. No quiero que se vea oscuro o triste.",
    budget: [60000, 100000], timing: "flexible", stop: ny, created: 0.2, source: { utm_source: "instagram", utm_medium: "bio" }, refs: [1, 2],
  });
  // 2 · Jordan: a quote waiting, for the London guest spot.
  const jordan = await client("jordan", "Jordan Lee", "jordan@example.com", "en", "jordanlee");
  await brief({
    key: "jordan", client: jordan, ref: "B-3HX9P", status: "new", style: "surrealism", color: "color", placement: "back_upper", body: "m", height: 183, w: 30, h: 24,
    description: "A melting clock draped over a marble bust, with a flock of birds turning into sheet music as they fly toward the shoulder blades. Muted colour, mostly ochre and teal.",
    budget: [200000, 400000], timing: "specific", dates: "Any day while you're in London", stop: london, created: 1.4, source: { utm_source: "meta", utm_campaign: "london-guest-spot" }, refs: [3],
  });
  // 3 · Amara: accepted, the chat open, nothing confirmed yet: "Confirmar cotización" is the next step.
  const amara = await client("amara", "Amara Okafor", "amara@example.com", "en", null);
  const amaraBrief = await brief({
    key: "amara", client: amara, ref: "B-9TC2W", status: "needs_info", style: "fine_line", color: "black_grey", placement: "ribs_L", body: "f", height: 170, w: 8, h: 14, first: true,
    description: "A small botanical piece with my mother's birth flower, the line work very delicate.",
    budget: [20000, 50000], timing: "asap", stop: ny, created: 3, refs: [11],
  });
  await say(amaraBrief, "artist", "Hi Amara! Love this. Which flower is it? If you have a photo of the real flower, send it over so I can draw it from life.", ago(2));
  await say(amaraBrief, "client", "It's a larkspur! Sending a photo from my mom's garden. I'd love it around 12 cm along the rib.", ago(1.6));

  // 4 · Daniel (the demo client): booked on the 28th, $1,000 session with the $100 booking paid; the artist collects the rest in the demo.
  const daniel = await client("daniel", "Daniel Reyes", "daniel@example.com", "es", "dreyes", DEMO_CLIENT_USER_ID);
  const danielBrief = await brief({
    key: "daniel", client: daniel, ref: "B-5NV8R", status: "booked", style: "realism", color: "black_grey", placement: "forearm_outer_R", body: "m", height: 176, w: 14, h: 20,
    description: "Un león con una corona de laurel en el antebrazo, mirando de frente. Black and grey, con la melena bien detallada. Es mi primer tatuaje grande.",
    avoid: "Sin color. Nada de texto.",
    budget: [80000, 120000], timing: "flexible", stop: ny, created: 16, source: { utm_source: "google" }, refs: [5, 10],
  });
  await quote({
    key: "daniel", brief: danielBrief, client: daniel, name: "Daniel Reyes", locale: "es", stopId: ny, city: "New York", tz: "America/New_York", starts: onDay(28, 12), hours: 6, total: 100000,
    message: "Tu proyecto quedó evaluado en $1,000 por la sesión completa. Con la reservación de $100 aseguras tu fecha; los $900 restantes se pagan al terminar.",
    sent: ago(14.5), paid: ago(14),
  });

  // 5 · Chloé: booked on the 21st in New York, deposit paid, the balance still to come.
  const chloe = await client("chloe", "Chloé Martin", "chloe@example.com", "en", "chloe.mrtn");
  const chloeBrief = await brief({
    key: "chloe", client: chloe, ref: "B-2PL6J", status: "booked", style: "surrealism", color: "color", placement: "thigh_L", body: "f", height: 168, w: 14, h: 20,
    description: "A whale swimming through a night sky full of lanterns, deep blues with warm gold lights.",
    budget: [100000, 200000], timing: "flexible", stop: ny, created: 12, refs: [4, 8, 9],
  });
  await quote({
    key: "chloe", brief: chloeBrief, client: chloe, name: "Chloé Martin", locale: "en", stopId: ny, city: "New York", tz: "America/New_York", starts: onDay(21, 11), hours: 6, total: 120000,
    message: "Your project is quoted at $1,200 for the full session. A $100 deposit books the date; the remaining $1,100 is paid when we finish.",
    sent: ago(10.5), paid: ago(10),
  });

  // 6 · Tomás: a second, smaller session the same 21st, in the afternoon.
  const tomas = await client("tomas", "Tomás Herrera", "tomas@example.com", "es", null);
  const tomasBrief = await brief({
    key: "tomas", client: tomas, ref: "B-6RV1D", status: "booked", style: "illustrative", color: "black_grey", placement: "calf_R", body: "m", height: 181, w: 10, h: 14,
    description: "Unas manos de escultor sosteniendo un cincel, estilo grabado, en la pantorrilla.",
    budget: [50000, 80000], timing: "specific", dates: "Cualquier tarde", stop: ny, created: 8, refs: [6],
  });
  await quote({
    key: "tomas", brief: tomasBrief, client: tomas, name: "Tomás Herrera", locale: "es", stopId: ny, city: "New York", tz: "America/New_York", starts: onDay(21, 17), hours: 3, total: 60000,
    message: "Tu proyecto quedó evaluado en $600 por la sesión. Con el abono de $100 reservas la fecha; los $500 restantes se pagan al terminar.",
    sent: ago(7.2), paid: ago(7),
  });

  // 7 · Valeria: booked on the 25th in New York.
  const valeria = await client("valeria", "Valeria Soto", "valeria@example.com", "es", null);
  const valeriaBrief = await brief({
    key: "valeria", client: valeria, ref: "B-4MR2K", status: "booked", style: "realism", color: "black_grey", placement: "shoulder_R", body: "f", height: 170, w: 12, h: 18,
    description: "Una garza parada en agua quieta, con el reflejo. Black and grey suave, en el hombro.",
    budget: [100000, 200000], timing: "specific", dates: "Fines de semana", stop: ny, created: 9, refs: [7, 12],
  });
  await quote({
    key: "valeria", brief: valeriaBrief, client: valeria, name: "Valeria Soto", locale: "es", stopId: ny, city: "New York", tz: "America/New_York", starts: onDay(25, 12), hours: 5, total: 90000,
    message: "Tu proyecto quedó evaluado en $900 por la sesión. Con el abono de $100 reservas la fecha; los $800 restantes se pagan al terminar.",
    sent: ago(8.4), paid: ago(8),
  });

  // Sessions already booked on the road, so the guest-spot calendars show taken days.
  const marcus = await client("marcus", "Marcus Hill", "marcus@example.com", "en", null);
  const marcusBrief = await brief({ key: "marcus", client: marcus, ref: "B-6QT8N", status: "booked", style: "realism", color: "black_grey", placement: "calf_L", body: "m", height: 180, w: 12, h: 18, description: "Bust of Apollo with a crack of light through the marble.", budget: [100000, 200000], timing: "specific", stop: miami, created: 14, refs: [2] });
  await quote({ key: "marcus", brief: marcusBrief, client: marcus, name: "Marcus Hill", locale: "en", stopId: miami, city: "Miami", tz: "America/New_York", starts: at(21, 12), hours: 7, total: 150000, message: "Quoted at $1,500 for the session. $100 books it; $1,400 when we finish.", sent: ago(12.5), paid: ago(12) });
  const lena = await client("lena", "Lena Park", "lena@example.com", "en", null);
  const lenaBrief = await brief({ key: "lena", client: lena, ref: "B-1ZC5V", status: "booked", style: "realism", color: "black_grey", placement: "shoulder_L", body: "f", height: 165, w: 12, h: 18, description: "A moth over a melting candle, fine shading.", budget: [100000, 200000], timing: "specific", stop: la, created: 14, refs: [3] });
  await quote({ key: "lena", brief: lenaBrief, client: lena, name: "Lena Park", locale: "en", stopId: la, city: "Los Angeles", tz: "America/Los_Angeles", starts: at(33, 12), hours: 6, total: 140000, message: "Quoted at $1,400 for the session. $100 books it; $1,300 when we finish.", sent: ago(12.5), paid: ago(12) });

  // A declined one, for the record.
  const kevin = await client("kevin", "Kevin Brooks", "kevin@example.com", "en", null);
  const kevinBrief = await brief({
    key: "kevin", client: kevin, ref: "B-8WD3F", status: "declined", style: "lettering", color: "black_grey", placement: "hand_R", body: "m", height: 180, w: 6, h: 4,
    description: "My daughter's name in cursive on the side of my hand.",
    budget: [20000, 50000], timing: "asap", stop: ny, created: 9,
  });
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, created_at) values ($1, $2, 'declined', 'artist', $3, $4)`, [
    s, kevinBrief, "Thanks Kevin! Lettering isn't my speciality, so I'd point you to a script artist for the cleanest result.", ago(8),
  ]);

  if (world) {
    await seedWorld(db);
    await seedHouse(db);
  } else {
    // Daniel Reyes has an account: his chats with Camo are his.
    await db.query(`insert into client_users (user_id, email, name, locale, home_city, city_slug) values ($1, $2, 'Daniel Reyes', 'es', 'New York', 'new-york') on conflict do nothing`, [DEMO_CLIENT_USER_ID, "daniel@example.com"]);
    await db.query(`insert into follows (user_id, artist_id) values ($1, $2) on conflict do nothing`, [DEMO_CLIENT_USER_ID, a]);
  }
  if (!(await db.one(`select 1 from studios where slug = 'tattoo-by-sova'`))) await seedSova(db);
  // The demo pages are all public already.
  await db.query(`update artists set launched_at = coalesce(launched_at, created_at)`);
}
