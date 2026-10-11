"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireMember, type Member } from "@/lib/auth";
import { newWorkSentRecently, notifyFollowers } from "@/lib/alerts";
import { isTrade, STYLE_BY_SLUG, TIMEZONES, TRADE_BY_SLUG } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { env, live } from "@/lib/env";
import { zonedToUtc } from "@/lib/format";
import { placeCity } from "@/lib/geo";
import { messageToClient, quoteToClient, waitlistOpen } from "@/lib/messages";
import { accountReady, connectLink } from "@/lib/payments";
import { can, isFull, lockedSql } from "@/lib/plan";
import { notify } from "@/lib/push";
import { clampBox, DocSchema, keysOf } from "@/lib/magazine";
import { fileUrl, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, removeFile, VIDEO_TYPES } from "@/lib/storage";
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
  title: z.string().trim().max(120),
  style: z.string().refine((s) => s === "" || STYLE_BY_SLUG.has(s)),
  color_mode: z.enum(["", "black_grey", "color"]),
  is_healed: z.boolean(),
  published: z.boolean(),
  featured: z.boolean(),
  story: z.string().trim().max(1200),
});

export async function updatePortfolioItem(id: string, patch: z.input<typeof PortfolioPatch>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const p = PortfolioPatch.parse(patch);
  const db = await getDb();
  const before = await db.one<{ featured: boolean }>(`select featured from portfolio_items where id = $1 and studio_id = $2`, [id, member.studioId]);
  if (!before) return;
  if (p.featured && !before.featured && !can(member.plan, "magazine")) return { error: dict(await getLocale()).studio.plan.locked };
  await db.query(
    `update portfolio_items set title = $3, style = $4, color_mode = $5, is_healed = $6, published = $7, featured = $8, story = $9 where id = $1 and studio_id = $2`,
    [id, member.studioId, p.title || null, p.style || null, p.color_mode || null, p.is_healed, p.published, p.featured, p.story || null],
  );
  // A piece joining the magazine is news for followers, at most once a week per artist.
  if (p.featured && !before.featured && !(await newWorkSentRecently(db, member.artistId))) {
    await notifyFollowers(db, { artistId: member.artistId, kind: "new_work" });
    flushLater();
  }
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

export async function addFlashItems(uploadToken: string, keys: string[]): Promise<{ error?: string } | void> {
  const member = await requireMember();
  if (!can(member.plan, "flash")) return { error: dict(await getLocale()).studio.plan.locked };
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

export async function updateFlashItem(id: string, patch: z.input<typeof FlashPatch>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  if (!can(member.plan, "flash")) return { error: dict(await getLocale()).studio.plan.locked };
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
  if (!s.is_home && !can(member.plan, "spots")) return { ok: false, message: t.studio.plan.locked };
  const db = await getDb();
  const place = placeCity(s.city, s.country);
  const values = [s.city, s.country, s.studio_name || null, s.address || null, s.timezone, s.starts_on || null, s.ends_on || null, s.status, s.is_home, place.city_slug, place.lat, place.lng];
  let stopId: string;
  let announce = false;
  if (s.id) {
    const before = await db.one<{ status: string; is_home: boolean }>(`select status, is_home from tour_stops where id = $1 and studio_id = $2`, [s.id, member.studioId]);
    if (!before) return { ok: false, message: t.common.error };
    await db.query(
      `update tour_stops set city = $3, country = $4, studio_name = $5, address = $6, timezone = $7, starts_on = $8, ends_on = $9, status = $10, is_home = $11,
              city_slug = $12, lat = $13, lng = $14
        where id = $1 and studio_id = $2`,
      [s.id, member.studioId, ...values],
    );
    stopId = s.id;
    announce = !s.is_home && s.status === "booking" && before.status !== "booking";
  } else {
    const created = await db.one<{ id: string }>(
      `insert into tour_stops (studio_id, artist_id, city, country, studio_name, address, timezone, starts_on, ends_on, status, is_home, city_slug, lat, lng)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
      [member.studioId, member.artistId, ...values],
    );
    stopId = created!.id;
    // People who asked for this city move onto the new stop's waitlist, so "Email the waitlist" reaches them.
    await db.query(`update waitlist set tour_stop_id = $3 where artist_id = $1 and tour_stop_id is null and lower(city) = lower($2)`, [member.artistId, s.city, stopId]);
    announce = !s.is_home && s.status !== "done";
  }
  if (announce) {
    await notifyFollowers(db, {
      artistId: member.artistId,
      kind: "spot",
      payload: { stopId, city: s.city, citySlug: place.city_slug, startsOn: s.starts_on || null, endsOn: s.ends_on || null },
    });
    flushLater();
  }
  revalidatePath("/studio/cities");
  revalidatePath("/", "layout");
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
  country: z.string().trim().max(80),
  trade: z.string().refine(isTrade),
  listed: z.boolean(),
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
    country: form.get("country") ?? "",
    trade: form.get("trade") ?? "tattoo",
    listed: form.get("listed") === "on",
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
  const before = await db.one<{ trade: string; booking_mode: string; accepting: boolean }>(`select trade, booking_mode, accepting from artists where id = $1 and studio_id = $2`, [member.artistId, member.studioId]);
  if (!before) return { ok: false, message: t.common.error };
  // A new trade brings its own way of booking; the artist can change it again later.
  const bookingMode = p.trade === before.trade ? before.booking_mode : TRADE_BY_SLUG.get(p.trade)!.bookingMode;
  const place = p.home_city ? placeCity(p.home_city, p.country) : { city_slug: null, country: p.country || null, lat: null, lng: null };
  await db.query(
    `update artists set display_name = $3, headline = $4, bio = $5, instagram = $6, home_city = $7, styles = $8, accepting = $9, min_price_cents = $10,
            cover_word = $11, cover_quote = $12, since_year = $13, accent = $14, cover_poster = $15,
            trade = $16, booking_mode = $17, country = $18, city_slug = $19, lat = $20, lng = $21, listed = $22
      where id = $1 and studio_id = $2`,
    [
      member.artistId, member.studioId, p.display_name, p.headline || null, p.bio || null, p.instagram || null, p.home_city || null, p.styles, p.accepting,
      p.min_price === "" ? null : Math.round(p.min_price * 100), p.cover_word || null, p.cover_quote || null, p.since_year === "" ? null : p.since_year, p.accent || null, p.cover_poster,
      p.trade, bookingMode, place.country, place.city_slug, place.lat, place.lng, p.listed,
    ],
  );
  if (p.accepting && !before.accepting) {
    await notifyFollowers(db, { artistId: member.artistId, kind: "books_open" });
    flushLater();
  }
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

/* ------------------------------------------------------------------ magazine */

/** Upload targets for the magazine's frames: photos up to 10 MB, videos up to 60 MB. */
export async function prepareMagazineUploads(files: { type: string; size: number }[]) {
  await requireMember();
  const photo = ["image/jpeg", "image/png", "image/webp"];
  const video = Object.keys(VIDEO_TYPES);
  const ok =
    files.length > 0 &&
    files.length <= 10 &&
    files.every((f) => f.size > 0 && ((photo.includes(f.type) && f.size <= MAX_IMAGE_BYTES) || (video.includes(f.type) && f.size <= MAX_VIDEO_BYTES)));
  if (!ok) return null;
  return createUploadTargets(files.map((f) => ({ kind: "media" as const, type: f.type, size: f.size })));
}

/** Move uploaded magazine media into the public bucket; returns each new key with the URL to show it. */
export async function addMagazineMedia(uploadToken: string, keys: string[]): Promise<{ key: string; url: string }[]> {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId) return [];
  const { moveDraftToPublic } = await import("@/lib/storage-move");
  const out: { key: string; url: string }[] = [];
  for (const key of keys.slice(0, 10)) {
    if (!(await inspectUpload(draftId, key, { video: true }))) continue;
    const publicKey = await moveDraftToPublic(key, `magazine/${member.artistId}`);
    out.push({ key: publicKey, url: await fileUrl("public", publicKey) });
  }
  return out;
}

/**
 * Save the artist's magazine. Every box is pulled back inside the printable
 * area, and every file it shows must be the artist's own: their uploads,
 * their portfolio, their cover photo.
 */
export async function saveMagazine(input: unknown): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  if (!can(member.plan, "magazine")) return { error: t.studio.plan.locked };
  const parsed = DocSchema.safeParse(input);
  if (!parsed.success) return { error: t.magazine.editor.error };
  const doc = parsed.data;
  doc.cover.boxes = doc.cover.boxes.map((b) => clampBox(b, true));
  doc.pages = doc.pages.map((p) => ({ ...p, boxes: p.boxes.map((b) => clampBox(b)) }));
  const db = await getDb();
  const own = await db.query<{ k: string }>(
    `select image_path as k from portfolio_items where artist_id = $1 and image_path is not null
     union select portrait_path from artists where id = $1 and portrait_path is not null`,
    [member.artistId],
  );
  const mine = new Set(own.map((r) => r.k));
  // Files the saved magazine already shows stay allowed (the starter layout places photos outside the portfolio too).
  const saved = await db.one<{ magazine: unknown }>(`select magazine from artists where id = $1`, [member.artistId]);
  const before = saved?.magazine ? DocSchema.safeParse(typeof saved.magazine === "string" ? JSON.parse(saved.magazine) : saved.magazine) : null;
  if (before?.success) keysOf(before.data).forEach((k) => mine.add(k));
  const prefixes = [`magazine/${member.artistId}/`, `portfolio/${member.artistId}/`, `portrait/${member.artistId}/`];
  if (!keysOf(doc).every((k) => mine.has(k) || (prefixes.some((p) => k.startsWith(p)) && !k.includes("..")))) return { error: t.magazine.editor.error };
  const row = await db.one<{ slug: string }>(`update artists set magazine = $3::jsonb where id = $1 and studio_id = $2 returning slug`, [member.artistId, member.studioId, JSON.stringify(doc)]);
  if (row) revalidatePath(`/${row.slug}`);
  revalidatePath("/studio/magazine");
}

/** Throw the layout away; the next open builds the starter magazine from the portfolio again. */
export async function resetMagazine() {
  const member = await requireMember();
  const db = await getDb();
  const row = await db.one<{ slug: string }>(`update artists set magazine = null where id = $1 and studio_id = $2 returning slug`, [member.artistId, member.studioId]);
  if (row) revalidatePath(`/${row.slug}`);
  revalidatePath("/studio/magazine");
}

/* ------------------------------------------------------------------ chat */

async function chatBrief(member: Member, briefId: string) {
  const db = await getDb();
  const brief = await db.one<{ id: string; status: string; chat_token: string; client_email: string; client_locale: "en" | "es"; client_user: string | null; artist_name: string; currency: string }>(
    `select b.id, b.status, b.chat_token, c.email as client_email, c.locale as client_locale, c.user_id as client_user, a.display_name as artist_name, a.currency
       from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id
      where b.id = $1 and b.studio_id = $2`,
    [briefId, member.studioId],
  );
  // A basic studio past its daily allowance can't answer a locked request.
  const locked = brief && !isFull(member.plan) ? await db.one(`${lockedSql("$1")} and b.id = $2`, [member.studioId, briefId]) : null;
  return { db, brief: locked ? null : brief };
}

/** The artist writes in the conversation; the client hears by email, with the link back in. */
export async function sendArtistMessage(briefId: string, text: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const body = z.string().trim().min(1).max(3000).safeParse(text);
  if (!body.success) return { error: t.common.error };
  const { db, brief } = await chatBrief(member, briefId);
  if (!brief || brief.status === "archived") return { error: t.common.error };
  await db.tx(async (tx) => {
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'message', 'artist', $3)`, [member.studioId, briefId, body.data]);
    await tx.query(`update briefs set artist_read_at = now(), seen_at = coalesce(seen_at, now()), updated_at = now() where id = $1`, [briefId]);
  });
  // The client hears in the app: a notification on their phone, the chat badge and the "New" mark.
  after(() => notify([brief.client_user], { title: brief.artist_name, body: body.data, url: `/c/${brief.chat_token}`, tag: `chat:${briefId}` }));
  revalidatePath("/studio", "layout");
}

const Offer = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.coerce.number().positive().max(14),
  stopId: z.string().uuid(),
  price: z.coerce.number().positive().max(100000),
  deposit: z.coerce.number().positive().max(100000),
  message: z.string().trim().max(1000),
});

/**
 * Offer the client a date: the agreed day and hour, the estimate, and the
 * first payment the artist asks to hold it. It lands in the conversation as a
 * card the client can take; once paid it is in both calendars.
 */
export async function offerReservation(briefId: string, input: z.input<typeof Offer>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const f = t.chat.offerForm;
  const parsed = Offer.safeParse(input);
  if (!parsed.success) return { error: f.invalid };
  const o = parsed.data;
  if (o.deposit > o.price) return { error: f.depositTooHigh };
  const { db, brief } = await chatBrief(member, briefId);
  if (!brief || ["booked", "declined", "archived"].includes(brief.status)) return { error: t.common.error };
  const stop = await db.one<{ id: string; timezone: string }>(`select id, timezone from tour_stops where id = $1 and artist_id = $2`, [o.stopId, member.artistId]);
  if (!stop) return { error: t.common.error };
  const start = zonedToUtc(o.date, o.time, stop.timezone);
  if (start.getTime() < Date.now()) return { error: f.past };
  const end = new Date(start.getTime() + o.hours * 3600_000);
  const off = await db.one(`select 1 from days_off where artist_id = $1 and day = $2::date`, [member.artistId, o.date]);
  if (off) return { error: f.dayOff };
  const clash = await db.one(
    `select 1 from appointments where artist_id = $1 and status = 'confirmed' and tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)`,
    [member.artistId, start.toISOString(), end.toISOString()],
  );
  if (clash) return { error: f.taken };

  const artist = await db.one<{ deposit_policy: unknown }>(`select deposit_policy from artists where id = $1`, [member.artistId]);
  const cents = (n: number) => Math.round(n * 100);
  const quoteToken = token();
  await db.tx(async (tx) => {
    // A new offer replaces any open one in the same conversation.
    await tx.query(`update quotes set status = 'withdrawn' where brief_id = $1 and status in ('sent', 'viewed')`, [briefId]);
    const row = await tx.one<{ id: string }>(
      `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at)
       values ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11) returning id`,
      [member.studioId, briefId, member.artistId, quoteToken, cents(o.price), o.hours, cents(o.deposit), brief.currency, o.message || null, JSON.stringify(artist!.deposit_policy), new Date(Math.min(start.getTime(), Date.now() + 7 * 86400_000)).toISOString()],
    );
    await tx.query(`insert into quote_slots (studio_id, quote_id, starts_at, ends_at, timezone, tour_stop_id) values ($1, $2, $3, $4, $5, $6)`, [
      member.studioId, row!.id, start.toISOString(), end.toISOString(), stop.timezone, stop.id,
    ]);
    await tx.query(`update briefs set status = 'quoted', artist_read_at = now(), seen_at = coalesce(seen_at, now()), updated_at = now() where id = $1`, [briefId]);
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'offer', 'artist', $3, $4)`, [
      member.studioId, briefId, o.message || null, JSON.stringify({ quote_id: row!.id }),
    ]);
  });
  const pt = dict(brief.client_locale).push;
  after(() => notify([brief.client_user], { title: fill(pt.offerFrom, { artist: brief.artist_name }), body: o.message || `${o.date} · ${o.time}`, url: `/c/${brief.chat_token}`, tag: `chat:${briefId}` }));
  revalidatePath("/studio", "layout");
}

/** Opening a conversation marks it read for the artist. */
export async function markArtistRead(briefId: string) {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`update briefs set artist_read_at = now(), seen_at = coalesce(seen_at, now()) where id = $1 and studio_id = $2`, [briefId, member.studioId]);
}

/* ------------------------------------------------------------------ agenda */

/** Close or reopen a whole day in the artist's agenda. */
export async function toggleDayOff(day: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const db = await getDb();
  const gone = await db.one(`delete from days_off where artist_id = $1 and day = $2::date returning day`, [member.artistId, day]);
  if (!gone) await db.query(`insert into days_off (artist_id, studio_id, day) values ($1, $2, $3::date) on conflict do nothing`, [member.artistId, member.studioId, day]);
  revalidatePath("/studio/agenda");
  const row = await db.one<{ slug: string }>(`select slug from artists where id = $1`, [member.artistId]);
  if (row) revalidatePath(`/${row.slug}`);
}
