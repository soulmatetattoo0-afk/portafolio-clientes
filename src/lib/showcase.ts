import { dict, fill, type Locale } from "@/i18n";

import { styleLabel } from "./catalog";
import type { Db } from "./db";
import { money, sessionTime, zonedToUtc } from "./format";
import { placementLabel } from "./messages";
import { token } from "./util";

/**
 * The showcase: a visitor who books with an artist that has it on walks the
 * whole road in a demo. Their request goes to the artist's stand-in (its own
 * studio, nobody in it, so the real inbox, calendar and Caja never see it),
 * and the stand-in plays the artist: it reads the request and writes back,
 * shows a piece of its work, sends a proposal and edits it, takes a simulated
 * deposit, "does" the session when asked and collects the rest.
 *
 * Nothing runs on a clock in the background: each time the chat is opened or
 * asks for news, `advanceShowcase` adds whatever step has come due. Every
 * step is marked in its event's data (`demo`), so a step is written once.
 */

export interface Stand {
  id: string;
  studio_id: string;
  display_name: string;
  accepting: boolean;
  currency: string;
}

const COPIED = `display_name, headline, bio, home_city, styles, accepting, min_price_cents, currency, deposit_policy, portrait_path, accent,
  default_deposit_cents, default_session_hours, default_start_time, precare, postcare, closed_weekdays, trade, country, cover_word, cover_quote, since_year`;

/** The artist's stand-in, made the first time and kept in step with the artist (name, colour, prices, care letters, cities). */
export async function standIn(db: Db, artistId: string): Promise<Stand | null> {
  const real = await db.one<{ id: string; slug: string; display_name: string; showcase: boolean }>(`select id, slug, display_name, showcase from artists where id = $1 and showcase_of is null`, [artistId]);
  if (!real?.showcase) return null;
  const slug = `${real.slug.slice(0, 34)}-demo`.replace(/-+/g, "-");
  let stand = await db.one<{ id: string; studio_id: string }>(`select id, studio_id from artists where showcase_of = $1`, [artistId]);
  if (!stand) {
    await db.tx(async (tx) => {
      const studio = await tx.one<{ id: string }>(
        `insert into studios (slug, name, kind, plan, subscription_status) values ($1, $2, 'solo', 'full', 'active')
         on conflict (slug) do update set name = excluded.name returning id`,
        [slug, `${real.display_name} · demo`],
      );
      await tx.query(
        `insert into artists (studio_id, slug, listed, showcase_of, ${COPIED})
         select $2, $3, false, a.id, ${COPIED.split(",").map((c) => `a.${c.trim()}`).join(", ")} from artists a where a.id = $1
         on conflict do nothing`,
        [artistId, studio!.id, slug],
      );
    });
    stand = await db.one<{ id: string; studio_id: string }>(`select id, studio_id from artists where showcase_of = $1`, [artistId]);
    if (!stand) return null;
  } else {
    // Whatever the artist changed since (a new colour, prices, care letters) shows in the demo too.
    await db.query(
      `update artists s set (${COPIED}) = (select ${COPIED} from artists a where a.id = $1) where s.id = $2`,
      [artistId, stand.id],
    );
  }
  // The same cities, so the demo's dates fall where the artist really works.
  const stops = await db.query<{ city: string; country: string; studio_name: string | null; address: string | null; timezone: string; starts_on: string | null; ends_on: string | null; is_home: boolean; status: string }>(
    `select city, country, studio_name, address, timezone, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on, is_home, status from tour_stops where artist_id = $1`,
    [artistId],
  );
  const mine = await db.query<{ id: string; city: string }>(`select id, city from tour_stops where artist_id = $1`, [stand.id]);
  for (const s of stops) {
    const have = mine.find((m) => m.city === s.city);
    if (have)
      await db.query(`update tour_stops set country = $2, studio_name = $3, address = $4, timezone = $5, starts_on = $6, ends_on = $7, is_home = $8, status = $9 where id = $1`, [
        have.id, s.country, s.studio_name, s.address, s.timezone, s.starts_on, s.ends_on, s.is_home, s.status,
      ]);
    else
      await db.query(
        `insert into tour_stops (studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, is_home, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [stand.studio_id, stand.id, s.city, s.country, s.studio_name, s.address, s.timezone, s.starts_on, s.ends_on, s.is_home, s.status],
      );
  }
  // An artist with no cities yet still gets a date: at home, on their clock.
  if (!stops.length && !mine.length) {
    const home = await db.one<{ home_city: string | null; country: string | null; currency: string }>(`select home_city, country, currency from artists where id = $1`, [artistId]);
    const chile = home?.currency === "clp";
    await db.query(`insert into tour_stops (studio_id, artist_id, city, country, timezone, is_home) values ($1, $2, $3, $4, $5, true)`, [
      stand.studio_id, stand.id, home?.home_city ?? (chile ? "Santiago" : "New York"), home?.country ?? (chile ? "CL" : "US"), chile ? "America/Santiago" : "America/New_York",
    ]);
  }
  return db.one<Stand>(`select id, studio_id, display_name, accepting, currency from artists where id = $1`, [stand.id]);
}

/** The stand-in's stop for the city the visitor picked on the artist's page. */
export async function standStop(db: Db, standId: string, realStopId: string | null): Promise<string | null> {
  if (!realStopId) return null;
  const row = await db.one<{ id: string }>(`select s.id from tour_stops s join tour_stops r on r.city = s.city where r.id = $1 and s.artist_id = $2`, [realStopId, standId]);
  return row?.id ?? null;
}

/** Is this conversation (by its private link) a showcase one? */
export async function isShowcaseChat(db: Db, chatToken: string): Promise<boolean> {
  return Boolean(await db.one(`select 1 from briefs b join artists a on a.id = b.artist_id where b.chat_token = $1 and a.showcase_of is not null`, [chatToken]));
}

/* ------------------------------------------------------------------ the script */

/** Where the demo stands, for the chat's hint and the typing dots. */
export type ShowcaseStage = "waiting" | "write" | "offer" | "booked" | "rest" | "done" | "cancelled";
export interface ShowcaseState {
  stage: ShowcaseStage;
  /** The artist is "typing": the next line comes on its own within a few seconds. */
  typing: boolean;
}

interface Ev {
  kind: string;
  actor: string;
  step: string | null;
  at: number;
}

const S = 1000;
/** A line written with an empty name reads as if none was ever there: "¡Hola !" → "¡Hola!", "Listo , la" → "Listo, la", "mí, ." → "mí.". */
const tidy = (s: string) => s.replace(/,\s*([.!?])/g, "$1").replace(/\s+([!,.?])/g, "$1");
const round = (cents: number, step: number) => Math.max(step, Math.round(cents / step) * step);

/** A believable price for the piece: by its size (or a full-day session for a large area), in the artist's currency. */
function priceFor(card: { full_coverage: boolean; size_w_cm: number | null; size_h_cm: number | null; currency: string }) {
  // Amounts are ×100 in every currency, CLP too.
  const clp = card.currency === "clp";
  if (card.full_coverage) return (clp ? 650_000 : 900) * 100;
  const area = Math.max(20, (card.size_w_cm ?? 10) * (card.size_h_cm ?? 10));
  if (clp) return Math.min(1_400_000 * 100, round((120_000 + area * 1_100) * 100, 10_000 * 100));
  return Math.min(2_000 * 100, round((180 + area * 1.6) * 100, 1000));
}

/**
 * Add the steps that have come due. Returns null when the conversation is not
 * a showcase one. Each brief is advanced under its own lock, so two open tabs
 * never write a step twice.
 */
export async function advanceShowcase(db: Db, chatToken: string): Promise<ShowcaseState | null> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(chatToken)) return null;
  const head = await db.one<{ id: string }>(`select b.id from briefs b join artists a on a.id = b.artist_id where b.chat_token = $1 and a.showcase_of is not null`, [chatToken]);
  if (!head) return null;
  return db.tx(async (tx) => {
    const b = await tx.one<{
      id: string; studio_id: string; artist_id: string; status: string; style: string; placement: string; full_coverage: boolean; size_w_cm: number | null; size_h_cm: number | null;
      currency: string; timing: string; preferred_dates: string | null; tour_stop_id: string | null; created_at: Date; client_name: string; locale: Locale; real_id: string;
      deposit: number | null; hours: number | null; start: string | null; closed: number[];
    }>(
      `select b.id, b.studio_id, b.artist_id, b.status, b.style, b.placement, b.full_coverage, b.size_w_cm::float as size_w_cm, b.size_h_cm::float as size_h_cm, b.currency,
              b.timing, b.preferred_dates, b.tour_stop_id, b.created_at, c.name as client_name, c.locale, a.showcase_of as real_id,
              a.default_deposit_cents as deposit, a.default_session_hours::float as hours, a.default_start_time as start, a.closed_weekdays as closed
         from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id where b.id = $1 for update of b`,
      [head.id],
    );
    if (!b) return null;
    const t = dict(b.locale).showcase.script;
    // A guest has no name of their own yet ("Invitado 5AFB"): the artist just says hi.
    const name = /^(invitado|guest)\b/i.test(b.client_name) ? "" : b.client_name.split(" ")[0];
    const events = (
      await tx.query<{ kind: string; actor: string; step: string | null; created_at: Date }>(`select kind, actor, data->>'demo' as step, created_at from brief_events where brief_id = $1 order by created_at`, [b.id])
    ).map((e): Ev => ({ kind: e.kind, actor: e.actor, step: e.step, at: new Date(e.created_at).getTime() }));
    const now = Date.now();
    const did = (step: string) => events.find((e) => e.step === step);
    const last = events.length ? events[events.length - 1].at : now;
    // Each new line is stamped after the one before, so the order never depends on the clock of the moment.
    let stamp = Math.max(now, last + 50);
    const say = async (text: string, step: string, data: Record<string, unknown> = {}) => {
      stamp += 900;
      const body = tidy(text);
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data, created_at) values ($1, $2, 'message', 'artist', $3, $4, $5)`, [
        b.studio_id, b.id, body, JSON.stringify({ ...data, demo: step }), new Date(stamp).toISOString(),
      ]);
    };
    const words = () => {
      const size = b.full_coverage ? "" : b.size_w_cm && b.size_h_cm ? `, ${b.size_w_cm} × ${b.size_h_cm} cm` : "";
      return { style: styleLabel(b.style, b.locale), placement: placementLabel(b.placement, b.locale).toLowerCase(), size };
    };
    const appointment = await tx.one<{ id: string; status: string; starts_at: Date; timezone: string }>(
      `select id, status, starts_at, timezone from appointments where brief_id = $1 order by created_at desc limit 1`,
      [b.id],
    );
    const balancePaid = events.some((e) => e.kind === "balance_paid");
    const paid = events.find((e) => e.kind === "paid");

    // 1. The artist reads the request and writes back.
    const hello = did("hello");
    if (!hello) {
      if (now - new Date(b.created_at).getTime() < 5 * S) return { stage: "waiting", typing: true } satisfies ShowcaseState;
      const w = words();
      await say(fill(t.hello, { name, style: w.style.toLowerCase(), placement: w.placement }), "hello");
      await tx.query(`update briefs set status = 'needs_info', seen_at = coalesce(seen_at, now()), updated_at = now() where id = $1 and status = 'new'`, [b.id]);
      return { stage: "write", typing: false };
    }

    // 2. A piece of the artist's own work, as the language for this one.
    const clientAfter = events.filter((e) => e.actor === "client" && e.kind === "message" && e.at > hello.at);
    if (!did("sketch")) {
      const due = clientAfter.length ? clientAfter[0].at + 5 * S : hello.at + 40 * S;
      if (now < due) return { stage: "write", typing: clientAfter.length > 0 };
      const piece = await tx.one<{ image_path: string }>(
        `select image_path from portfolio_items where artist_id = $1 and published and image_path is not null
          order by (style = $2) desc, sort, created_at limit 1`,
        [b.real_id, b.style],
      );
      await say(t.sketch, "sketch", piece ? { image: piece.image_path } : {});
      return { stage: "write", typing: true };
    }

    // 3. The proposal; 4. edited a moment later, and saved at the top of the chat.
    const offer = did("offer");
    if (!offer) {
      if (now < did("sketch")!.at + 6 * S) return { stage: "write", typing: true };
      await propose(tx, b, "offer", t, stamp);
      return { stage: "offer", typing: true };
    }
    if (!did("edit")) {
      if (now < offer.at + 9 * S) return { stage: "offer", typing: true };
      stamp = await propose(tx, b, "edit", t, stamp);
      stamp += 900;
      await say(fill(t.saved, { name }), "saved");
      return { stage: "offer", typing: false };
    }

    // The client cancelled: the artist answers once, by the seven-day rule.
    if (appointment?.status === "cancelled") {
      if (!did("cancelled")) {
        // The client's own cancelling line says which side of the seven days it fell on.
        const lastWord = await tx.one<{ body: string | null }>(`select body from brief_events where brief_id = $1 and actor = 'client' and kind = 'message' order by created_at desc limit 1`, [b.id]);
        const late = lastWord?.body === dict(b.locale).chat.cancel.byClientLate;
        await say(fill(late ? t.cancelledLate : t.cancelled, { name }), "cancelled");
      }
      return { stage: "cancelled", typing: false };
    }

    // 5. Booked: the artist thanks, with the date.
    if (!paid || !appointment) return { stage: "offer", typing: false };
    if (!did("thanks")) {
      if (now < paid.at + 3 * S) return { stage: "booked", typing: true };
      const when = sessionTime(new Date(appointment.starts_at), appointment.timezone, b.locale);
      await say(fill(t.thanks, { date: `${when.day} · ${when.time}` }), "thanks");
      return { stage: "booked", typing: false };
    }
    if (appointment.status === "confirmed") return { stage: "booked", typing: false };

    // 6. The session is done (the visitor skipped to it) and the rest is asked; 7. paid: the artist says goodbye.
    if (!balancePaid) return { stage: "rest", typing: false };
    const settled = events.find((e) => e.kind === "balance_paid")!;
    if (!did("bye")) {
      if (now < settled.at + 4 * S) return { stage: "done", typing: true };
      await say(fill(t.bye, { name }), "bye");
    }
    return { stage: "done", typing: false };
  });
}

type Brief = { id: string; studio_id: string; artist_id: string; style: string; placement: string; full_coverage: boolean; size_w_cm: number | null; size_h_cm: number | null; currency: string; timing: string; preferred_dates: string | null; tour_stop_id: string | null; locale: Locale; deposit: number | null; hours: number | null; start: string | null; closed: number[] };

/**
 * The stand-in's proposal: a date in the visitor's city (the one they asked
 * for when it is free, else the next open day at least twelve days out, so a
 * cancellation can still be refunded), the price for the size, and the
 * artist's usual deposit. The edit replaces it with the agreed version.
 */
async function propose(tx: Db, b: Brief, step: "offer" | "edit", t: ReturnType<typeof dict>["showcase"]["script"], stamp: number): Promise<number> {
  const stop = await tx.one<{ id: string; city: string; timezone: string; starts_on: string | null; ends_on: string | null }>(
    `select id, city, timezone, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on from tour_stops
      where artist_id = $1 order by (id = $2) desc, is_home desc, created_at limit 1`,
    [b.artist_id, b.tour_stop_id],
  );
  if (!stop) return stamp;
  const hours = b.full_coverage ? 5 : (b.hours ?? 3);
  const time = b.start && /^\d{2}:\d{2}$/.test(b.start) ? b.start : "12:00";
  const base = priceFor(b);
  const price = step === "edit" ? round(base * 0.94, b.currency === "clp" ? 10_000 * 100 : 1000) : base;
  const deposit = Math.min(b.deposit ?? Math.round(price * 0.25), Math.round(price * 0.4));

  // The day: the one the visitor asked for if it is open, or the next open one; never a day another demo already holds.
  let start: Date;
  let end: Date;
  if (step === "edit") {
    const prev = await tx.one<{ starts_at: Date; ends_at: Date }>(
      `select s.starts_at, s.ends_at from quotes q join quote_slots s on s.quote_id = q.id where q.brief_id = $1 and q.status in ('sent', 'viewed') order by q.created_at desc limit 1`,
      [b.id],
    );
    start = prev ? new Date(prev.starts_at) : new Date();
    end = prev ? new Date(prev.ends_at) : new Date();
  } else {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: stop.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const asked = b.timing === "specific" ? /\d{4}-\d{2}-\d{2}/.exec(b.preferred_dates ?? "")?.[0] : undefined;
    const from = [addDays(today, 12), stop.starts_on].filter(Boolean).sort().pop()!;
    const busy = new Set(
      (
        await tx.query<{ day: string }>(
          `select to_char(s.starts_at at time zone $2, 'YYYY-MM-DD') as day from quote_slots s join quotes q on q.id = s.quote_id
            where q.artist_id = $1 and s.status in ('held', 'booked') and s.starts_at > now()
           union select to_char(starts_at at time zone $2, 'YYYY-MM-DD') from appointments where artist_id = $1 and status = 'confirmed' and starts_at > now()`,
          [b.artist_id, stop.timezone],
        )
      ).map((r) => r.day),
    );
    const open = (day: string) => {
      const weekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
      return !busy.has(day) && weekday !== 7 && !(b.closed ?? []).map(Number).includes(weekday) && (!stop.ends_on || day <= stop.ends_on);
    };
    let day = asked && asked >= addDays(today, 8) && open(asked) ? asked : from;
    for (let i = 0; i < 400 && !open(day); i++) day = addDays(day, 1);
    start = zonedToUtc(day, time, stop.timezone);
    end = new Date(start.getTime() + hours * 3600_000);
  }

  const w = { style: styleLabel(b.style, b.locale), placement: placementLabel(b.placement, b.locale).toLowerCase(), size: b.full_coverage ? "" : b.size_w_cm && b.size_h_cm ? `, ${b.size_w_cm} × ${b.size_h_cm} cm` : "" };
  const note = fill(step === "edit" ? t.editNote : t.offerNote, { ...w, hours: String(hours), city: stop.city });
  await tx.query(`update quotes set status = 'withdrawn' where brief_id = $1 and status in ('sent', 'viewed')`, [b.id]);
  const policy = await tx.one<{ deposit_policy: unknown }>(`select deposit_policy from artists where id = $1`, [b.artist_id]);
  const q = await tx.one<{ id: string }>(
    `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at)
     values ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11) returning id`,
    [b.studio_id, b.id, b.artist_id, token(), price, hours, deposit, b.currency, note, JSON.stringify(policy?.deposit_policy ?? {}), new Date(Math.min(start.getTime(), Date.now() + 14 * 86_400_000)).toISOString()],
  );
  await tx.query(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id) values ($1, $2, $3, $4, $5, $6)`, [
    b.studio_id, q!.id, start.toISOString(), end.toISOString(), stop.timezone, stop.id,
  ]);
  await tx.query(`update briefs set status = 'quoted', updated_at = now() where id = $1`, [b.id]);
  let at = stamp;
  if (step === "edit") {
    // The artist says what changed, then the new card replaces the old one.
    at += 900;
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data, created_at) values ($1, $2, 'message', 'artist', $3, $4, $5)`, [
      b.studio_id, b.id, fill(t.edit, { total: money(price, b.currency, b.locale) }), JSON.stringify({ demo: "edit-note" }), new Date(at).toISOString(),
    ]);
  }
  at += 900;
  await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data, created_at) values ($1, $2, 'offer', 'artist', $3, $4, $5)`, [
    b.studio_id, b.id, note, JSON.stringify({ quote_id: q!.id, demo: step }), new Date(at).toISOString(),
  ]);
  return at;
}

/**
 * The visitor skips to the tattoo day: the session is marked done and the
 * artist asks for the rest in the chat, as the real artist does with one tap.
 */
export async function skipToSession(db: Db, chatToken: string): Promise<boolean> {
  const ap = await db.one<{ id: string; studio_id: string; brief_id: string; locale: Locale; price: number; deposit: number; currency: string }>(
    `select ap.id, ap.studio_id, ap.brief_id, c.locale, q.price_min_cents as price, q.deposit_cents as deposit, q.currency
       from appointments ap join briefs b on b.id = ap.brief_id join artists a on a.id = b.artist_id join clients c on c.id = b.client_id join quotes q on q.id = ap.quote_id
      where b.chat_token = $1 and a.showcase_of is not null and ap.status = 'confirmed'
      order by ap.created_at desc limit 1`,
    [chatToken],
  );
  if (!ap) return false;
  const rest = Math.max(0, ap.price - ap.deposit);
  await db.tx(async (tx) => {
    await tx.query(`update appointments set status = 'completed', balance_cents = $2 where id = $1`, [ap.id, rest]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'message', 'artist', $3, $4)`, [
      ap.studio_id, ap.brief_id, fill(dict(ap.locale).showcase.script.session, { amount: money(rest, ap.currency, ap.locale) }), JSON.stringify({ demo: "session" }),
    ]);
  });
  return true;
}

/**
 * Right before the simulated deposit: if another visitor's demo took that
 * day in the meantime, the slot moves to the next free day, so the booking
 * always goes through.
 */
export async function freeShowcaseSlot(db: Db, slotId: string) {
  const s = await db.one<{ id: string; artist_id: string; starts_at: Date; ends_at: Date }>(
    `select s.id, q.artist_id, s.starts_at, s.ends_at from quote_slots s join quotes q on q.id = s.quote_id where s.id = $1`,
    [slotId],
  );
  if (!s) return;
  let start = new Date(s.starts_at).getTime();
  const span = new Date(s.ends_at).getTime() - start;
  for (let i = 0; i < 60; i++) {
    const clash = await db.one(
      `select 1 from appointments where artist_id = $1 and status = 'confirmed' and tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)`,
      [s.artist_id, new Date(start).toISOString(), new Date(start + span).toISOString()],
    );
    if (!clash) break;
    start += 86_400_000;
  }
  if (start !== new Date(s.starts_at).getTime())
    await db.query(`update quote_slots set starts_at = $2, ends_at = $3 where id = $1`, [s.id, new Date(start).toISOString(), new Date(start + span).toISOString()]);
}
