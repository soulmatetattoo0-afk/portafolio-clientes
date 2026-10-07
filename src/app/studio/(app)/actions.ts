"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireMember, type Member } from "@/lib/auth";
import { STYLE_BY_SLUG, TIMEZONES } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { env, live } from "@/lib/env";
import { zonedToUtc } from "@/lib/format";
import { messageToClient, quoteToClient, waitlistOpen } from "@/lib/messages";
import { accountReady, connectLink } from "@/lib/payments";
import { removeFile } from "@/lib/storage";
import { createUploadTargets, inspectUpload, readDraftToken } from "@/lib/uploads";
import { token } from "@/lib/util";

export interface FormState {
  ok: boolean;
  message: string | null;
  field?: string;
}

async function loadBrief(member: Member, briefId: string) {
  const db = await getDb();
  const brief = await db.one<{
    id: string;
    status: string;
    placement: string;
    client_name: string;
    client_email: string;
    client_locale: "en" | "es";
    artist_name: string;
    tour_stop_id: string | null;
  }>(
    `select b.id, b.status, b.placement, c.name as client_name, c.email as client_email, c.locale as client_locale, a.display_name as artist_name, b.tour_stop_id
       from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id
      where b.id = $1 and b.studio_id = $2`,
    [briefId, member.studioId],
  );
  return { db, brief };
}

const flushLater = () =>
  after(async () => {
    await flushOutbox(await getDb());
  });

/* ------------------------------------------------------------------ quotes */

const Slot = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  stopId: z.string().uuid(),
});

const Quote = z
  .object({
    priceMin: z.coerce.number().positive().max(100000),
    priceMax: z.union([z.literal(""), z.coerce.number().positive().max(100000)]),
    sessions: z.coerce.number().int().min(1).max(40),
    hours: z.union([z.literal(""), z.coerce.number().positive().max(14)]),
    deposit: z.coerce.number().positive().max(100000),
    message: z.string().trim().max(3000),
    expiresDays: z.coerce.number().int().refine((n) => [3, 7, 14, 30].includes(n)),
    slots: z.array(Slot).min(1).max(6),
  })
  .refine((q) => q.priceMax === "" || q.priceMax >= q.priceMin, { path: ["priceMax"] })
  .refine((q) => q.deposit <= (q.priceMax === "" ? q.priceMin : q.priceMax), { path: ["deposit"] });

export async function sendQuote(briefId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const f = t.studio.quoteForm;
  const dates = form.getAll("slotDate").map(String);
  const times = form.getAll("slotTime").map(String);
  const stops = form.getAll("slotStop").map(String);
  const parsed = Quote.safeParse({
    priceMin: form.get("priceMin"),
    priceMax: form.get("priceMax") ?? "",
    sessions: form.get("sessions"),
    hours: form.get("hours") ?? "",
    deposit: form.get("deposit"),
    message: form.get("message") ?? "",
    expiresDays: form.get("expiresDays"),
    slots: dates.map((date, i) => ({ date, time: times[i], stopId: stops[i] })).filter((s) => s.date && s.time),
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const message = field === "slots" ? f.dateRequiredForm : field === "deposit" ? f.depositRequired : f.priceRequired;
    return { ok: false, message, field };
  }
  const q = parsed.data;
  const { db, brief } = await loadBrief(member, briefId);
  if (!brief || ["booked", "declined"].includes(brief.status)) return { ok: false, message: t.common.error };

  const stopRows = await db.query<{ id: string; timezone: string }>(`select id, timezone from tour_stops where artist_id = $1 and id = any($2::uuid[])`, [
    member.artistId,
    [...new Set(q.slots.map((s) => s.stopId))],
  ]);
  const tzOf = new Map(stopRows.map((s) => [s.id, s.timezone]));
  const hours = q.hours === "" ? 4 : q.hours;
  const slots: { start: Date; end: Date; tz: string; stopId: string }[] = [];
  for (const s of q.slots) {
    const tz = tzOf.get(s.stopId);
    if (!tz) return { ok: false, message: t.common.error };
    const start = zonedToUtc(s.date, s.time, tz);
    if (start.getTime() < Date.now()) return { ok: false, message: f.datePast, field: "slots" };
    slots.push({ start, end: new Date(start.getTime() + hours * 3600_000), tz, stopId: s.stopId });
  }

  const artist = await db.one<{ deposit_policy: unknown; currency: string }>(`select deposit_policy, currency from artists where id = $1`, [member.artistId]);
  const cents = (n: number) => Math.round(n * 100);
  const quoteToken = token();
  const expiresAt = new Date(Date.now() + q.expiresDays * 86400_000);

  await db.tx(async (tx) => {
    // A new quote replaces any open one for the same brief.
    await tx.query(`update quotes set status = 'withdrawn' where brief_id = $1 and status in ('sent', 'viewed')`, [briefId]);
    const row = await tx.one<{ id: string }>(
      `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, price_max_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [
        member.studioId, briefId, member.artistId, quoteToken, cents(q.priceMin), q.priceMax === "" ? null : cents(q.priceMax), q.sessions,
        q.hours === "" ? null : q.hours, cents(q.deposit), artist!.currency, q.message || null, JSON.stringify(artist!.deposit_policy), expiresAt.toISOString(),
      ],
    );
    for (const s of slots) {
      await tx.query(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id) values ($1, $2, $3, $4, $5, $6)`, [
        member.studioId, row!.id, s.start.toISOString(), s.end.toISOString(), s.tz, s.stopId,
      ]);
    }
    await tx.query(`update briefs set status = 'quoted', updated_at = now() where id = $1`, [briefId]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'quoted', 'artist', $3, $4)`, [
      member.studioId, briefId, q.message || null, JSON.stringify({ quote_id: row!.id }),
    ]);
  });

  await enqueueEmail(
    db,
    quoteToClient({
      to: brief.client_email,
      artist: brief.artist_name,
      artistEmail: member.email,
      placement: brief.placement,
      token: quoteToken,
      priceMin: cents(q.priceMin),
      priceMax: q.priceMax === "" ? null : cents(q.priceMax),
      deposit: cents(q.deposit),
      currency: artist!.currency,
      sessions: q.sessions,
      expiresAt,
      message: q.message,
      locale: brief.client_locale,
    }),
    { studioId: member.studioId, template: "quote", dedupeKey: `quote:${quoteToken}` },
  );
  flushLater();
  revalidatePath("/studio", "layout");
  redirect(`/studio?tab=quoted&brief=${briefId}&sent=quote`);
}

/* ------------------------------------------------------------------ ask / decline / archive */

const Message = z.string().trim().min(2).max(3000);

export async function askDetails(briefId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const message = Message.safeParse(form.get("message"));
  if (!message.success) return { ok: false, message: t.common.error, field: "message" };
  const { db, brief } = await loadBrief(member, briefId);
  if (!brief) return { ok: false, message: t.common.error };
  const ct = dict(brief.client_locale);
  await db.tx(async (tx) => {
    await tx.query(`update briefs set status = 'needs_info', updated_at = now() where id = $1`, [briefId]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'info_requested', 'artist', $3)`, [member.studioId, briefId, message.data]);
  });
  await enqueueEmail(
    db,
    messageToClient({
      to: brief.client_email,
      artist: brief.artist_name,
      artistEmail: member.email,
      subject: fill(ct.email.ask.subject, { artist: brief.artist_name }),
      message: message.data,
      hint: ct.email.ask.replyHint,
      locale: brief.client_locale,
    }),
    { studioId: member.studioId, template: "ask" },
  );
  flushLater();
  revalidatePath("/studio", "layout");
  return { ok: true, message: fill(t.studio.ask.sent, { email: brief.client_email }) };
}

export async function declineBrief(briefId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const message = Message.safeParse(form.get("message"));
  if (!message.success) return { ok: false, message: t.common.error, field: "message" };
  const { db, brief } = await loadBrief(member, briefId);
  if (!brief || brief.status === "booked") return { ok: false, message: t.common.error };
  const ct = dict(brief.client_locale);
  await db.tx(async (tx) => {
    await tx.query(`update briefs set status = 'declined', updated_at = now() where id = $1`, [briefId]);
    await tx.query(`update quotes set status = 'withdrawn' where brief_id = $1 and status in ('sent', 'viewed')`, [briefId]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'declined', 'artist', $3)`, [member.studioId, briefId, message.data]);
  });
  await enqueueEmail(
    db,
    messageToClient({
      to: brief.client_email,
      artist: brief.artist_name,
      artistEmail: member.email,
      subject: fill(ct.email.decline.subject, { artist: brief.artist_name }),
      message: message.data,
      locale: brief.client_locale,
    }),
    { studioId: member.studioId, template: "decline" },
  );
  flushLater();
  revalidatePath("/studio", "layout");
  return { ok: true, message: t.studio.decline.done };
}

export async function setBriefStatus(briefId: string, status: "archived" | "new") {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`update briefs set status = $3, updated_at = now() where id = $1 and studio_id = $2 and status <> 'booked'`, [briefId, member.studioId, status]);
  revalidatePath("/studio", "layout");
}

/* ------------------------------------------------------------------ bookings */

export async function setAppointmentStatus(appointmentId: string, status: "completed" | "no_show" | "cancelled") {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`update appointments set status = $3 where id = $1 and studio_id = $2`, [appointmentId, member.studioId, status]);
  if (status === "cancelled") {
    await db.query(`update outbox set sent_at = now(), last_error = 'cancelled' where sent_at is null and dedupe_key like $1`, [`reminder%:${appointmentId}`]);
  }
  revalidatePath("/studio/bookings");
}

/* ------------------------------------------------------------------ portfolio */

export async function preparePortfolioUploads(files: { type: string; size: number }[]) {
  await requireMember();
  const ok = files.length <= 20 && files.every((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size > 0 && f.size <= 10 * 1024 * 1024);
  if (!ok) return null;
  return createUploadTargets(files.map((f) => ({ kind: "reference" as const, type: f.type, size: f.size })));
}

export async function addPortfolioItems(uploadToken: string, keys: string[]) {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId) return;
  const db = await getDb();
  const max = await db.one<{ n: number }>(`select coalesce(max(sort), 0)::int as n from portfolio_items where artist_id = $1`, [member.artistId]);
  let sort = max?.n ?? 0;
  for (const key of keys.slice(0, 20)) {
    // Portfolio uploads land in the private drafts area first, then move to the public bucket.
    if (!(await inspectUpload(draftId, key))) continue;
    const { moveDraftToPublic } = await import("@/lib/storage-move");
    const publicKey = await moveDraftToPublic(key, `portfolio/${member.artistId}`);
    await db.query(`insert into portfolio_items (studio_id, artist_id, image_path, sort) values ($1, $2, $3, $4)`, [member.studioId, member.artistId, publicKey, ++sort]);
  }
  revalidatePath("/studio/portfolio");
}

const PortfolioPatch = z.object({
  style: z.string().refine((s) => s === "" || STYLE_BY_SLUG.has(s)),
  color_mode: z.enum(["", "black_grey", "color"]),
  is_healed: z.boolean(),
  published: z.boolean(),
});

export async function updatePortfolioItem(id: string, patch: z.input<typeof PortfolioPatch>) {
  const member = await requireMember();
  const p = PortfolioPatch.parse(patch);
  const db = await getDb();
  await db.query(`update portfolio_items set style = $3, color_mode = $4, is_healed = $5, published = $6 where id = $1 and studio_id = $2`, [
    id, member.studioId, p.style || null, p.color_mode || null, p.is_healed, p.published,
  ]);
  revalidatePath("/studio/portfolio");
}

export async function deletePortfolioItem(id: string) {
  const member = await requireMember();
  const db = await getDb();
  const row = await db.one<{ image_path: string | null }>(`delete from portfolio_items where id = $1 and studio_id = $2 returning image_path`, [id, member.studioId]);
  if (row?.image_path) await removeFile("public", row.image_path).catch(() => undefined);
  revalidatePath("/studio/portfolio");
}

/** The cover photo: one upload, replaces the previous one. */
export async function setPortrait(uploadToken: string, key: string) {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId || !(await inspectUpload(draftId, key))) return;
  const { moveDraftToPublic } = await import("@/lib/storage-move");
  const publicKey = await moveDraftToPublic(key, `portrait/${member.artistId}`);
  const db = await getDb();
  const old = await db.one<{ portrait_path: string | null }>(`update artists set portrait_path = $3 where id = $1 and studio_id = $2 returning (select portrait_path from artists where id = $1) as portrait_path`, [
    member.artistId, member.studioId, publicKey,
  ]);
  if (old?.portrait_path && old.portrait_path !== publicKey && !old.portrait_path.startsWith("demo/")) await removeFile("public", old.portrait_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

export async function removePortrait() {
  const member = await requireMember();
  const db = await getDb();
  const row = await db.one<{ portrait_path: string | null }>(`update artists set portrait_path = null where id = $1 and studio_id = $2 returning portrait_path`, [member.artistId, member.studioId]);
  if (row?.portrait_path && !row.portrait_path.startsWith("demo/")) await removeFile("public", row.portrait_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ flash designs */

export async function addFlashItems(uploadToken: string, keys: string[]) {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId) return;
  const db = await getDb();
  const max = await db.one<{ n: number }>(`select coalesce(max(sort), 0)::int as n from flash_designs where artist_id = $1`, [member.artistId]);
  const currency = (await db.one<{ currency: string }>(`select currency from artists where id = $1`, [member.artistId]))?.currency ?? "usd";
  let sort = max?.n ?? 0;
  for (const key of keys.slice(0, 20)) {
    if (!(await inspectUpload(draftId, key))) continue;
    const { moveDraftToPublic } = await import("@/lib/storage-move");
    const publicKey = await moveDraftToPublic(key, `flash/${member.artistId}`);
    await db.query(`insert into flash_designs (studio_id, artist_id, image_path, currency, sort) values ($1, $2, $3, $4, $5)`, [member.studioId, member.artistId, publicKey, currency, ++sort]);
  }
  revalidatePath("/studio/flash");
}

const FlashPatch = z.object({
  title: z.string().trim().max(80),
  description: z.string().trim().max(500),
  size_label: z.string().trim().max(40),
  price: z.union([z.literal(""), z.coerce.number().min(0).max(100000)]),
  status: z.enum(["available", "reserved", "taken"]),
  repeatable: z.boolean(),
  published: z.boolean(),
});

export async function updateFlashItem(id: string, patch: z.input<typeof FlashPatch>) {
  const member = await requireMember();
  const p = FlashPatch.parse(patch);
  const db = await getDb();
  await db.query(
    `update flash_designs set title = $3, description = $4, size_label = $5, price_cents = $6, status = $7, repeatable = $8, published = $9 where id = $1 and studio_id = $2`,
    [id, member.studioId, p.title, p.description || null, p.size_label || null, p.price === "" ? null : Math.round(p.price * 100), p.status, p.repeatable, p.published],
  );
  revalidatePath("/studio/flash");
  revalidatePath("/", "layout");
}

export async function deleteFlashItem(id: string) {
  const member = await requireMember();
  const db = await getDb();
  const row = await db.one<{ image_path: string | null }>(`delete from flash_designs where id = $1 and studio_id = $2 returning image_path`, [id, member.studioId]);
  if (row?.image_path) await removeFile("public", row.image_path).catch(() => undefined);
  revalidatePath("/studio/flash");
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ cities */

const Stop = z.object({
  id: z.string().uuid().optional(),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().max(80),
  studio_name: z.string().trim().max(120),
  address: z.string().trim().max(200),
  timezone: z.string().refine((tz) => TIMEZONES.includes(tz)),
  starts_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  ends_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  status: z.enum(["announced", "booking", "full", "done"]),
  is_home: z.boolean(),
});

export async function saveStop(_prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const parsed = Stop.safeParse({
    id: form.get("id") || undefined,
    city: form.get("city"),
    country: form.get("country") ?? "",
    studio_name: form.get("studio_name") ?? "",
    address: form.get("address") ?? "",
    timezone: form.get("timezone"),
    starts_on: form.get("starts_on") ?? "",
    ends_on: form.get("ends_on") ?? "",
    status: form.get("status"),
    is_home: form.get("is_home") === "on",
  });
  if (!parsed.success) return { ok: false, message: t.common.error, field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const s = parsed.data;
  if (s.starts_on && s.ends_on && s.ends_on < s.starts_on) return { ok: false, message: t.common.error, field: "ends_on" };
  const db = await getDb();
  const values = [s.city, s.country, s.studio_name || null, s.address || null, s.timezone, s.starts_on || null, s.ends_on || null, s.status, s.is_home];
  if (s.id) {
    await db.query(
      `update tour_stops set city = $3, country = $4, studio_name = $5, address = $6, timezone = $7, starts_on = $8, ends_on = $9, status = $10, is_home = $11
        where id = $1 and studio_id = $2`,
      [s.id, member.studioId, ...values],
    );
  } else {
    const created = await db.one<{ id: string }>(
      `insert into tour_stops (studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, status, is_home)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [member.studioId, member.artistId, ...values],
    );
    // People who asked for this city move onto the new stop's waitlist, so "Email the waitlist" reaches them.
    await db.query(`update waitlist set tour_stop_id = $3 where artist_id = $1 and tour_stop_id is null and lower(city) = lower($2)`, [member.artistId, s.city, created!.id]);
  }
  revalidatePath("/studio/cities");
  return { ok: true, message: t.common.saved };
}

export async function deleteStop(id: string) {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`delete from tour_stops where id = $1 and studio_id = $2`, [id, member.studioId]);
  revalidatePath("/studio/cities");
}

export async function notifyWaitlist(stopId: string): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const db = await getDb();
  const stop = await db.one<{ city: string; artist: string; slug: string }>(
    `select t.city, a.display_name as artist, a.slug from tour_stops t join artists a on a.id = t.artist_id where t.id = $1 and t.studio_id = $2`,
    [stopId, member.studioId],
  );
  if (!stop) return { ok: false, message: t.common.error };
  const people = await db.query<{ id: string; email: string; locale: "en" | "es" }>(
    `select id, email, locale from waitlist where studio_id = $1 and (tour_stop_id = $2 or lower(city) = lower($3)) and notified_at is null`,
    [member.studioId, stopId, stop.city],
  );
  for (const p of people) {
    await enqueueEmail(db, waitlistOpen(p.email, { artist: stop.artist, slug: stop.slug, city: stop.city, locale: p.locale }), {
      studioId: member.studioId,
      template: "waitlist",
      dedupeKey: `waitlist:${p.id}:${stopId}`,
    });
    await db.query(`update waitlist set notified_at = now() where id = $1`, [p.id]);
  }
  await db.query(`update tour_stops set status = 'booking' where id = $1 and status = 'announced'`, [stopId]);
  flushLater();
  revalidatePath("/studio/cities");
  return { ok: true, message: fill(t.studio.cities.notified, { n: people.length }) };
}

/* ------------------------------------------------------------------ settings */

const Profile = z.object({
  display_name: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(140),
  bio: z.string().trim().max(1500),
  instagram: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v.replace(/^@/, "")),
  home_city: z.string().trim().max(80),
  styles: z.array(z.string().refine((s) => STYLE_BY_SLUG.has(s))).max(10),
  accepting: z.boolean(),
  min_price: z.union([z.literal(""), z.coerce.number().min(0).max(100000)]),
  cover_word: z.string().trim().max(24),
  cover_quote: z.string().trim().max(160),
  since_year: z.union([z.literal(""), z.coerce.number().int().min(1950).max(2100)]),
  accent: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
  cover_poster: z.boolean(),
});

export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const parsed = Profile.safeParse({
    display_name: form.get("display_name"),
    headline: form.get("headline") ?? "",
    bio: form.get("bio") ?? "",
    instagram: form.get("instagram") ?? "",
    home_city: form.get("home_city") ?? "",
    styles: form.getAll("styles").map(String),
    accepting: form.get("accepting") === "on",
    min_price: form.get("min_price") ?? "",
    cover_word: form.get("cover_word") ?? "",
    cover_quote: form.get("cover_quote") ?? "",
    since_year: form.get("since_year") ?? "",
    accent: form.get("accent") ?? "",
    cover_poster: form.get("cover_poster") === "on",
  });
  if (!parsed.success) return { ok: false, message: t.common.error, field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const p = parsed.data;
  const db = await getDb();
  await db.query(
    `update artists set display_name = $3, headline = $4, bio = $5, instagram = $6, home_city = $7, styles = $8, accepting = $9, min_price_cents = $10,
            cover_word = $11, cover_quote = $12, since_year = $13, accent = $14, cover_poster = $15
      where id = $1 and studio_id = $2`,
    [
      member.artistId, member.studioId, p.display_name, p.headline || null, p.bio || null, p.instagram || null, p.home_city || null, p.styles, p.accepting,
      p.min_price === "" ? null : Math.round(p.min_price * 100), p.cover_word || null, p.cover_quote || null, p.since_year === "" ? null : p.since_year, p.accent || null, p.cover_poster,
    ],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: t.common.saved };
}

const Rules = z.object({
  refundable: z.boolean(),
  reschedule_notice_hours: z.coerce.number().int().min(0).max(720),
  reschedules_allowed: z.coerce.number().int().min(0).max(5),
  applies_to_final_price: z.boolean(),
});

export async function saveRules(_prev: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const parsed = Rules.safeParse({
    refundable: form.get("refundable") === "on",
    reschedule_notice_hours: form.get("reschedule_notice_hours"),
    reschedules_allowed: form.get("reschedules_allowed"),
    applies_to_final_price: form.get("applies_to_final_price") === "on",
  });
  if (!parsed.success) return { ok: false, message: t.common.error, field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const db = await getDb();
  await db.query(`update artists set deposit_policy = $3 where id = $1 and studio_id = $2`, [member.artistId, member.studioId, JSON.stringify(parsed.data)]);
  revalidatePath("/", "layout");
  return { ok: true, message: t.common.saved };
}

export async function startStripeConnect() {
  const member = await requireMember();
  if (!live.payments) redirect("/studio/settings");
  const db = await getDb();
  const artist = await db.one<{ stripe_account_id: string | null }>(`select stripe_account_id from artists where id = $1`, [member.artistId]);
  const { accountId, url } = await connectLink({ accountId: artist?.stripe_account_id ?? null, email: member.email, returnPath: "/studio/settings" });
  await db.query(`update artists set stripe_account_id = $2 where id = $1`, [member.artistId, accountId]);
  redirect(url);
}

/** Called when the artist returns from Stripe onboarding. */
export async function refreshStripeStatus() {
  const member = await requireMember();
  if (!live.payments) return;
  const db = await getDb();
  const artist = await db.one<{ stripe_account_id: string | null }>(`select stripe_account_id from artists where id = $1`, [member.artistId]);
  if (!artist?.stripe_account_id) return;
  const ready = await accountReady(artist.stripe_account_id);
  await db.query(`update artists set stripe_charges_enabled = $2 where id = $1`, [member.artistId, ready]);
}

export async function calendarFeedUrl() {
  const member = await requireMember();
  const { sign } = await import("@/lib/util");
  return `${env.appUrl}/api/calendar/${member.studioId}.${sign(`cal:${member.studioId}`)}.ics`;
}
