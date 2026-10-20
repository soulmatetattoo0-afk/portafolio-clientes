"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { KINDS_FOR, LayoutSchema } from "@/lib/layout";
import { loadBalance, recordBalance } from "@/lib/balance";
import { getLocale } from "@/i18n/server";
import { requireMember, type Member } from "@/lib/auth";
import { newWorkSentRecently, notifyFollowers } from "@/lib/alerts";
import { isTrade, STYLE_BY_SLUG, TIMEZONES, TRADE_BY_SLUG } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { confirmBooking } from "@/lib/booking";
import { demoMode, env, live } from "@/lib/env";
import { dateLong, money, sessionTime, zonedToUtc } from "@/lib/format";
import { placeCity } from "@/lib/geo";
import { messageToClient, quoteToClient, waitlistOpen } from "@/lib/messages";
import { launchChecklist } from "@/lib/launch";
import { accountReady, connectLink, createSubscriptionCheckout } from "@/lib/payments";
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
  const chat = await db.one<{ chat_token: string; client_user: string | null }>(`select b.chat_token, c.user_id as client_user from briefs b join clients c on c.id = b.client_id where b.id = $1`, [briefId]);
  if (chat) after(() => notify([chat.client_user], { title: brief.artist_name, body: message.data, url: `/c/${chat.chat_token}`, tag: `chat:${briefId}` }));
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
  section_id: z.string().uuid().nullable().optional(),
});

export async function updatePortfolioItem(id: string, patch: z.input<typeof PortfolioPatch>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const p = PortfolioPatch.parse(patch);
  const db = await getDb();
  const before = await db.one<{ featured: boolean }>(`select featured from portfolio_items where id = $1 and studio_id = $2`, [id, member.studioId]);
  if (!before) return;
  if (p.featured && !before.featured && !can(member.plan, "magazine")) return { error: dict(await getLocale()).studio.plan.locked };
  await db.query(
    `update portfolio_items set title = $3, style = $4, color_mode = $5, is_healed = $6, published = $7, featured = $8, story = $9,
            section_id = case when $10::uuid is null then null else (select id from portfolio_sections where id = $10::uuid and artist_id = portfolio_items.artist_id) end
      where id = $1 and studio_id = $2`,
    [id, member.studioId, p.title || null, p.style || null, p.color_mode || null, p.is_healed, p.published, p.featured, p.story || null, p.section_id ?? null],
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
  const defaults = z
    .object({
      deposit: z.coerce.number().min(0).max(100000).optional(),
      hours: z.coerce.number().min(0.5).max(14).optional(),
      start: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
    })
    .safeParse({
      deposit: form.get("default_deposit") || undefined,
      hours: form.get("default_hours") || undefined,
      start: form.get("default_start") ?? "",
    });
  if (!defaults.success) return { ok: false, message: t.common.error, field: "default_deposit" };
  const d = defaults.data;
  const db = await getDb();
  await db.query(`update artists set deposit_policy = $3, default_deposit_cents = $4, default_session_hours = $5, default_start_time = $6 where id = $1 and studio_id = $2`, [
    member.artistId, member.studioId, JSON.stringify(parsed.data), d.deposit != null ? Math.round(d.deposit * 100) : null, d.hours ?? null, d.start || null,
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: t.common.saved };
}

export async function startStripeConnect() {
  const member = await requireMember();
  if (!live.payments) redirect("/studio/ajustes");
  const db = await getDb();
  const artist = await db.one<{ stripe_account_id: string | null }>(`select stripe_account_id from artists where id = $1`, [member.artistId]);
  const { accountId, url } = await connectLink({ accountId: artist?.stripe_account_id ?? null, email: member.email, returnPath: "/studio/sala/stripe" });
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
    // Answering accepts the request: the ball is in the client's court until they write back.
    await tx.query(`update briefs set status = case when status = 'new' then 'needs_info' else status end, artist_read_at = now(), seen_at = coalesce(seen_at, now()), updated_at = now() where id = $1`, [briefId]);
    // The demo: the client answers on their own and the artist says the quote is coming, so the next step (evaluate it) is right there.
    if (demoMode && brief.status === "new") {
      const ct = dict(brief.client_locale).templates;
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, created_at) values ($1, $2, 'message', 'client', $3, now() + interval '1 second')`, [member.studioId, briefId, ct.demoReply]);
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, created_at) values ($1, $2, 'message', 'artist', $3, now() + interval '2 seconds')`, [member.studioId, briefId, ct.demoFollow]);
    }
  });
  // The client hears in the app: a notification on their phone, the chat badge and the "New" mark.
  after(() => notify([brief.client_user], { title: brief.artist_name, body: body.data, url: `/c/${brief.chat_token}`, tag: `chat:${briefId}` }));
  revalidatePath("/studio", "layout");
}

const Offer = z.object({
  /** date: the day they agreed. calendar: the client picks a day among the artist's open ones. */
  mode: z.enum(["date", "calendar"]).default("date"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
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
  if (o.mode === "date" && !o.date) return { error: f.invalid };
  const { db, brief } = await chatBrief(member, briefId);
  if (!brief || ["booked", "declined", "archived"].includes(brief.status)) return { error: t.common.error };
  const stop = await db.one<{ id: string; timezone: string }>(`select id, timezone from tour_stops where id = $1 and artist_id = $2`, [o.stopId, member.artistId]);
  if (!stop) return { error: t.common.error };
  const cents = (n: number) => Math.round(n * 100);
  const artist = await db.one<{ deposit_policy: unknown }>(`select deposit_policy from artists where id = $1`, [member.artistId]);
  const quoteToken = token();
  if (o.mode === "calendar") {
    // The calendar goes over as an offer with no date yet: the client picks one of the next 90 days.
    await db.tx(async (tx) => {
      await tx.query(`update quotes set status = 'withdrawn' where brief_id = $1 and status in ('sent', 'viewed')`, [briefId]);
      const row = await tx.one<{ id: string }>(
        `insert into quotes (studio_id, brief_id, artist_id, token, price_min_cents, sessions, hours_per_session, deposit_cents, currency, message, policy, expires_at, pick_stop_id, pick_time, pick_until)
         values ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, now() + interval '14 days', $11, $12, current_date + 90) returning id`,
        [member.studioId, briefId, member.artistId, quoteToken, cents(o.price), o.hours, cents(o.deposit), brief.currency, o.message || null, JSON.stringify(artist!.deposit_policy), stop.id, o.time],
      );
      await tx.query(`update briefs set status = 'quoted', artist_read_at = now(), seen_at = coalesce(seen_at, now()), updated_at = now() where id = $1`, [briefId]);
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'offer', 'artist', $3, $4)`, [
        member.studioId, briefId, o.message || null, JSON.stringify({ quote_id: row!.id, calendar: true }),
      ]);
    });
    const pt = dict(brief.client_locale);
    after(() => notify([brief.client_user], { title: fill(pt.push.offerFrom, { artist: brief.artist_name }), body: o.message || pt.chat.offerForm.calendarPush, url: `/c/${brief.chat_token}`, tag: `chat:${briefId}` }));
    revalidatePath("/studio", "layout");
    return;
  }
  const start = zonedToUtc(o.date!, o.time, stop.timezone);
  if (start.getTime() < Date.now()) return { error: f.past };
  const end = new Date(start.getTime() + o.hours * 3600_000);
  const off = await db.one(
    `select 1 from artists a where a.id = $1
        and (exists (select 1 from days_off where artist_id = $1 and day = $2::date) or extract(isodow from $2::date)::smallint = any(a.closed_weekdays))`,
    [member.artistId, o.date],
  );
  if (off) return { error: f.dayOff };
  const clash = await db.one(
    `select 1 from appointments where artist_id = $1 and status = 'confirmed' and tstzrange(starts_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)`,
    [member.artistId, start.toISOString(), end.toISOString()],
  );
  if (clash) return { error: f.taken };

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
  const when = sessionTime(start, stop.timezone, brief.client_locale);
  after(() => notify([brief.client_user], { title: fill(pt.offerFrom, { artist: brief.artist_name }), body: o.message || `${when.day} · ${when.time}`, url: `/c/${brief.chat_token}`, tag: `chat:${briefId}` }));
  revalidatePath("/studio", "layout");
}

/**
 * The client paid the booking straight to the artist (no card payments yet):
 * the artist confirms it here, and the booking goes through exactly as a card
 * payment would: the date in the calendar, the pre-care letter, Caja.
 */
export async function confirmDirectDeposit(briefId: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const db = await getDb();
  const t = dict(await getLocale());
  const q = await db.one<{ id: string; slot_id: string; deposit_cents: number; currency: string }>(
    `select q.id, s.id as slot_id, q.deposit_cents, q.currency
       from quotes q join quote_slots s on s.quote_id = q.id
      where q.brief_id = $1 and q.studio_id = $2 and q.status in ('sent', 'viewed') and s.status in ('offered', 'held')
      order by q.created_at desc limit 1`,
    [briefId, member.studioId],
  );
  if (!q) return { error: t.common.error };
  const r = await confirmBooking(db, { quoteId: q.id, slotId: q.slot_id, provider: demoMode ? "demo" : "manual", checkoutId: `direct:${q.id}`, amountCents: q.deposit_cents, currency: q.currency });
  if (r.slotTaken) return { error: t.chat.offerForm.taken };
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

const Session = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.coerce.number().min(0.5).max(14),
  note: z.string().trim().max(500).optional(),
});

/** The artist's home time zone, where sessions added by hand happen. */
async function homeZone(member: Member) {
  const db = await getDb();
  return (await db.one<{ timezone: string; city: string }>(`select timezone, city from tour_stops where artist_id = $1 order by is_home desc, created_at limit 1`, [member.artistId])) ?? { timezone: "America/New_York", city: null };
}

const clashes = (e: unknown) => /appointments_no_overlap|exclusion|conflicting key/i.test(String(e));

/** Add a session by hand: a walk-in, a client from outside the app, a block of time. */
export async function addSession(input: z.input<typeof Session> & { client: string }): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale()).agenda;
  const parsed = Session.extend({ client: z.string().trim().min(1).max(120) }).safeParse(input);
  if (!parsed.success) return { error: t.invalid };
  const s = parsed.data;
  const home = await homeZone(member);
  const start = zonedToUtc(s.date, s.time, home.timezone);
  const end = new Date(start.getTime() + s.hours * 3600_000);
  const db = await getDb();
  try {
    await db.tx(async (tx) => {
      const client = await tx.one<{ id: string }>(`insert into clients (studio_id, name, email) values ($1, $2, null) returning id`, [member.studioId, s.client]);
      await tx.query(
        `insert into appointments (studio_id, artist_id, client_id, starts_at, ends_at, timezone, city, note) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [member.studioId, member.artistId, client!.id, start.toISOString(), end.toISOString(), home.timezone, home.city, s.note || null],
      );
    });
  } catch (e) {
    if (clashes(e)) return { error: t.taken };
    throw e;
  }
  revalidatePath("/studio/agenda");
}

/** Tell the client in their conversation that their session changed, and on their phone. */
async function tellClient(member: Member, appointmentId: string, write: (a: { date: string; time: string; locale: "en" | "es" }) => string) {
  const db = await getDb();
  const ap = await db.one<{ brief_id: string | null; chat_token: string | null; client_user: string | null; locale: "en" | "es"; artist: string; starts_at: Date; timezone: string }>(
    `select ap.brief_id, b.chat_token, c.user_id as client_user, c.locale, a.display_name as artist, ap.starts_at, ap.timezone
       from appointments ap join clients c on c.id = ap.client_id join artists a on a.id = ap.artist_id left join briefs b on b.id = ap.brief_id
      where ap.id = $1 and ap.studio_id = $2`,
    [appointmentId, member.studioId],
  );
  if (!ap?.brief_id || !ap.chat_token) return;
  const date = dateLong(ap.starts_at, ap.locale, ap.timezone);
  const body = write({ date, time: sessionTime(ap.starts_at, ap.timezone, ap.locale).time, locale: ap.locale });
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'message', 'artist', $3)`, [member.studioId, ap.brief_id, body]);
  after(() => notify([ap.client_user], { title: ap.artist, body, url: `/c/${ap.chat_token}`, tag: `chat:${ap.brief_id}` }));
}

/** Move a session to another day or hour; a booked client hears it in the chat. */
export async function moveSession(appointmentId: string, input: z.input<typeof Session>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale()).agenda;
  const parsed = Session.safeParse(input);
  if (!parsed.success) return { error: t.invalid };
  const s = parsed.data;
  const db = await getDb();
  const ap = await db.one<{ timezone: string }>(`select timezone from appointments where id = $1 and studio_id = $2 and status = 'confirmed'`, [appointmentId, member.studioId]);
  if (!ap) return { error: t.invalid };
  const start = zonedToUtc(s.date, s.time, ap.timezone);
  const end = new Date(start.getTime() + s.hours * 3600_000);
  try {
    await db.query(`update appointments set starts_at = $3, ends_at = $4, note = coalesce($5, note) where id = $1 and studio_id = $2`, [appointmentId, member.studioId, start.toISOString(), end.toISOString(), s.note || null]);
  } catch (e) {
    if (clashes(e)) return { error: t.taken };
    throw e;
  }
  // Reminders were written for the old hour.
  await db.query(`update outbox set sent_at = now(), last_error = 'moved' where sent_at is null and dedupe_key like $1`, [`reminder%:${appointmentId}`]);
  await tellClient(member, appointmentId, ({ date, time, locale }) => fill(dict(locale).agenda.movedMsg, { date, time }));
  revalidatePath("/studio/agenda");
  revalidatePath("/studio/bookings");
}

/** Cancel a session; a booked client hears it in the chat. */
export async function cancelSession(appointmentId: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  await tellClient(member, appointmentId, ({ date, locale }) => fill(dict(locale).agenda.cancelledMsg, { date }));
  await setAppointmentStatus(appointmentId, "cancelled");
  revalidatePath("/studio/agenda");
}

/** The weekdays the artist never works (ISO: 1 = Monday … 7 = Sunday). */
export async function setClosedWeekdays(days: number[]): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  const db = await getDb();
  await db.query(`update artists set closed_weekdays = $2::smallint[] where id = $1`, [member.artistId, clean]);
  revalidatePath("/studio/agenda");
  const row = await db.one<{ slug: string }>(`select slug from artists where id = $1`, [member.artistId]);
  if (row) revalidatePath(`/${row.slug}`);
}

/** The artist sets what is left to pay for a booked session: the client pays it from the chat on the day. */
export async function setBalance(appointmentId: string, amount: number): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000) return { error: t.common.error };
  const db = await getDb();
  const paid = await db.one(`select 1 from payments where appointment_id = $1 and kind = 'balance' and status = 'paid'`, [appointmentId]);
  if (paid) return { error: t.chat.balance.done };
  const row = await db.one<{ brief_id: string | null }>(
    `update appointments set balance_cents = $3 where id = $1 and studio_id = $2 and status in ('confirmed', 'completed') returning brief_id`,
    [appointmentId, member.studioId, Math.round(amount * 100)],
  );
  if (!row) return { error: t.common.error };
  revalidatePath("/studio");
}

/** The owner arranges their front: which buttons, in what order, how big. The studio's front is for owners of a studio with several artists. */
export async function saveLayout(front: "artist" | "studio", tiles: unknown): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const parsed = LayoutSchema.safeParse(tiles);
  if (!parsed.success || parsed.data.some((x) => !KINDS_FOR[front].includes(x.kind))) return { error: t.common.error };
  const db = await getDb();
  if (front === "artist") {
    await db.query(`update artists set layout = $3 where id = $1 and studio_id = $2`, [member.artistId, member.studioId, JSON.stringify(parsed.data)]);
  } else {
    if (member.role !== "owner") return { error: t.common.error };
    await db.query(`update studios set layout = $2 where id = $1 and kind = 'studio'`, [member.studioId, JSON.stringify(parsed.data)]);
  }
  revalidatePath("/", "layout");
}

/** The artist asks for the rest of the tattoo: a message in the chat with the amount, and a notification on the client's phone. */
export async function requestBalance(appointmentId: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const db = await getDb();
  const ap = await db.one<{ brief_id: string; artist: string; client_user: string | null; client_locale: "en" | "es"; chat_token: string | null }>(
    `select ap.brief_id, ar.display_name as artist, c.user_id as client_user, c.locale as client_locale, b.chat_token
       from appointments ap join artists ar on ar.id = ap.artist_id join clients c on c.id = ap.client_id join briefs b on b.id = ap.brief_id
      where ap.id = $1 and ap.studio_id = $2`,
    [appointmentId, member.studioId],
  );
  const t = dict(await getLocale());
  if (!ap) return { error: t.common.error };
  const balance = await loadBalance(db, ap.brief_id);
  if (!balance || balance.paid || balance.amountCents === null) return { error: t.chat.balance.artistUnset };
  const ct = dict(ap.client_locale).chat.balance;
  const amount = money(balance.amountCents, balance.currency, ap.client_locale);
  const body = fill(ct.request, { amount });
  await db.query(`insert into brief_events (studio_id, brief_id, kind, actor, body) values ($1, $2, 'message', 'artist', $3)`, [member.studioId, ap.brief_id, body]);
  await notify([ap.client_user], { title: fill(ct.requestTitle, { name: ap.artist }), body, url: ap.chat_token ? `/c/${ap.chat_token}` : "/me", tag: `balance:${appointmentId}` });
  revalidatePath("/studio");
}

const SectionName = z.string().trim().min(1).max(60);

/** The artist's own sections of their work: add one, rename it, take it away (its pieces stay, unsorted). */
export async function addSection(name: string, style: string | null = null): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const n = SectionName.safeParse(name);
  if (!n.success || (style !== null && !STYLE_BY_SLUG.has(style))) return { error: dict(await getLocale()).common.error };
  const db = await getDb();
  await db.query(
    `insert into portfolio_sections (studio_id, artist_id, name, style, sort) values ($1, $2, $3, $4, coalesce((select max(sort) + 1 from portfolio_sections where artist_id = $2), 0))`,
    [member.studioId, member.artistId, n.data, style],
  );
  revalidatePath("/studio/portfolio");
}

export async function renameSection(id: string, name: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const n = SectionName.safeParse(name);
  if (!n.success) return { error: dict(await getLocale()).common.error };
  const db = await getDb();
  await db.query(`update portfolio_sections set name = $3 where id = $1 and artist_id = $2`, [id, member.artistId, n.data]);
  revalidatePath("/studio/portfolio");
}

export async function deleteSection(id: string) {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`delete from portfolio_sections where id = $1 and artist_id = $2`, [id, member.artistId]);
  revalidatePath("/studio/portfolio");
}

/** The button: the page goes public (search, city pages, the map) once everything is in place. */
export async function launchApp(): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const check = await launchChecklist(member.artistId);
  if (!check.ready) return { error: dict(await getLocale()).studio.launch.locked };
  const db = await getDb();
  await db.query(`update artists set launched_at = coalesce(launched_at, now()), listed = true where id = $1 and studio_id = $2`, [member.artistId, member.studioId]);
  revalidatePath("/", "layout");
}

/** VANTA Full: Stripe checkout with the launch offer (first month at half); in demo mode the plan switches at once. */
export async function startSubscription(): Promise<{ url: string } | { error: string }> {
  const member = await requireMember();
  const locale = await getLocale();
  const db = await getDb();
  const studio = await db.one<{ plan: string; stripe_customer_id: string | null }>(`select plan, stripe_customer_id from studios where id = $1`, [member.studioId]);
  if (!studio) return { error: dict(locale).common.error };
  if (!live.payments && !demoMode) return { error: dict(locale).common.error };
  if (!live.payments) {
    await db.query(`update studios set plan = 'full', subscription_status = 'active' where id = $1`, [member.studioId]);
    revalidatePath("/studio", "layout");
    return { url: "/studio/ajustes?subscribed=1" };
  }
  const { url } = await createSubscriptionCheckout({
    studioId: member.studioId,
    email: member.email,
    customerId: studio.stripe_customer_id,
    successUrl: `${env.appUrl}/studio/ajustes?subscribed=1`,
    cancelUrl: `${env.appUrl}/studio/ajustes`,
    locale,
    launchOffer: true,
  });
  return { url };
}

/** The piece that stands for its section on the styles carousel. */
export async function setSectionCover(sectionId: string, itemId: string) {
  const member = await requireMember();
  const db = await getDb();
  await db.query(
    `update portfolio_sections set cover_item_id = (select id from portfolio_items where id = $3 and artist_id = $2) where id = $1 and artist_id = $2`,
    [sectionId, member.artistId, itemId],
  );
  revalidatePath("/studio/portfolio");
}

/* ------------------------------------------------------------------ editing the page in place */

const Quick = z.object({
  display_name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(140).optional(),
  home_city: z.string().trim().max(80).optional(),
  cover_quote: z.string().trim().max(160).optional(),
  accepting: z.boolean().optional(),
  default_deposit: z.coerce.number().min(0).max(100000).optional(),
  min_price: z.coerce.number().min(0).max(100000).optional(),
  precare: z.string().trim().max(4000).optional(),
  postcare: z.string().trim().max(4000).optional(),
  styles: z.array(z.string().refine((x) => STYLE_BY_SLUG.has(x))).max(10).optional(),
});

/** A few words changed on the page itself: the name, the line, the city, the quote, whether books are open, the deposit. */
export async function quickArtist(patch: z.input<typeof Quick>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const p = Quick.safeParse(patch);
  if (!p.success) return { error: dict(await getLocale()).common.error };
  const d = p.data;
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [member.artistId, member.studioId];
  const put = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (d.display_name !== undefined) put("display_name", d.display_name);
  if (d.headline !== undefined) put("headline", d.headline || null);
  if (d.home_city !== undefined) put("home_city", d.home_city || null);
  if (d.cover_quote !== undefined) put("cover_quote", d.cover_quote || null);
  if (d.accepting !== undefined) put("accepting", d.accepting);
  if (d.default_deposit !== undefined) put("default_deposit_cents", Math.round(d.default_deposit * 100) || null);
  if (d.min_price !== undefined) put("min_price_cents", Math.round(d.min_price * 100) || null);
  if (d.precare !== undefined) put("precare", d.precare || null);
  if (d.postcare !== undefined) put("postcare", d.postcare || null);
  if (d.styles !== undefined) put("styles", d.styles);
  if (!sets.length) return;
  await db.query(`update artists set ${sets.join(", ")} where id = $1 and studio_id = $2`, vals);
  revalidatePath("/", "layout");
}

/** The illustration over the calendar: one upload, replaces the previous one. */
export async function setCalendarArt(uploadToken: string, key: string) {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId || !(await inspectUpload(draftId, key))) return;
  const { moveDraftToPublic } = await import("@/lib/storage-move");
  const publicKey = await moveDraftToPublic(key, `calendar/${member.artistId}`);
  const db = await getDb();
  const old = await db.one<{ calendar_art_path: string | null }>(`select calendar_art_path from artists where id = $1 and studio_id = $2`, [member.artistId, member.studioId]);
  await db.query(`update artists set calendar_art_path = $3 where id = $1 and studio_id = $2`, [member.artistId, member.studioId, publicKey]);
  if (old?.calendar_art_path && old.calendar_art_path !== publicKey) await removeFile("public", old.calendar_art_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

/** The cover of one city's calendar: a photo of the city, a piece, the artist's face. */
export async function setStopCover(stopId: string, uploadToken: string, key: string) {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId || !(await inspectUpload(draftId, key))) return;
  const { moveDraftToPublic } = await import("@/lib/storage-move");
  const publicKey = await moveDraftToPublic(key, `calendar/${member.artistId}/${stopId}`);
  const db = await getDb();
  const old = await db.one<{ cover_path: string | null }>(`update tour_stops set cover_path = $3 where id = $1 and artist_id = $2 returning (select cover_path from tour_stops where id = $1) as cover_path`, [stopId, member.artistId, publicKey]);
  if (old?.cover_path && old.cover_path !== publicKey && !old.cover_path.startsWith("demo/")) await removeFile("public", old.cover_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

/** Caja: an expense the artist writes down, or one they take back. */
export async function addExpense(input: { label: string; amount: number; day?: string }): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const t = dict(await getLocale());
  const parsed = z.object({ label: z.string().trim().min(1).max(120), amount: z.coerce.number().positive().max(1_000_000), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(input);
  if (!parsed.success) return { error: t.common.error };
  const db = await getDb();
  await db.query(`insert into expenses (studio_id, artist_id, label, amount_cents, day) values ($1, $2, $3, $4, coalesce($5::date, current_date))`, [member.studioId, member.artistId, parsed.data.label, Math.round(parsed.data.amount * 100), parsed.data.day ?? null]);
  revalidatePath("/studio", "layout");
}

export async function removeExpense(id: string): Promise<void> {
  const member = await requireMember();
  const db = await getDb();
  await db.query(`delete from expenses where id = $1 and studio_id = $2`, [id, member.studioId]);
  revalidatePath("/studio", "layout");
}

/* ------------------------------------------------------------------ the sketchbook */

const NoteBody = z.string().trim().min(1).max(280);

/** A note in the artist's sketchbook. */
export async function addNote(body: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const n = NoteBody.safeParse(body);
  if (!n.success) return { error: dict(await getLocale()).common.error };
  const db = await getDb();
  await db.query(`insert into artist_notes (studio_id, artist_id, body) values ($1, $2, $3)`, [member.studioId, member.artistId, n.data]);
  revalidatePath("/studio/sala");
}

/** Pin it, cross it out, or take it away. */
export async function setNote(id: string, patch: { pinned?: boolean; done?: boolean; remove?: boolean }): Promise<void> {
  const member = await requireMember();
  const db = await getDb();
  if (patch.remove) {
    await db.query(`delete from artist_notes where id = $1 and artist_id = $2`, [id, member.artistId]);
  } else {
    await db.query(
      `update artist_notes set pinned = coalesce($3, pinned), done_at = case when $4::boolean is null then done_at when $4 then now() else null end where id = $1 and artist_id = $2`,
      [id, member.artistId, patch.pinned ?? null, patch.done ?? null],
    );
  }
  revalidatePath("/studio/sala");
}

export async function removeCalendarArt() {
  const member = await requireMember();
  const db = await getDb();
  const row = await db.one<{ calendar_art_path: string | null }>(`update artists set calendar_art_path = null where id = $1 and studio_id = $2 returning calendar_art_path`, [member.artistId, member.studioId]);
  if (row?.calendar_art_path) await removeFile("public", row.calendar_art_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

/** The piece that fronts the work: it goes first. */
export async function putPieceFirst(itemId: string) {
  const member = await requireMember();
  const db = await getDb();
  await db.query(
    `update portfolio_items set sort = coalesce((select min(sort) from portfolio_items where artist_id = $3), 1) - 1 where id = $1 and studio_id = $2`,
    [itemId, member.studioId, member.artistId],
  );
  revalidatePath("/", "layout");
}

/** The magazine's cover picture, straight from the page: an upload becomes the poster cover. */
export async function setMagazineCover(uploadToken: string, key: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const [media] = await addMagazineMedia(uploadToken, [key]);
  if (!media) return { error: dict(await getLocale()).common.error };
  const { getMagazine } = await import("@/lib/magazine-server");
  const { doc } = await getMagazine(member.artistId);
  return saveMagazine({ ...doc, cover: { ...doc.cover, mode: "poster", poster: media.key, zoom: 1, fx: 50, fy: 30 } });
}

const QuickPiece = z.object({
  title: z.string().trim().max(120),
  story: z.string().trim().max(1200),
  section_id: z.string().uuid().or(z.literal("")),
  published: z.boolean(),
});

/** A piece changed from the gallery itself: its title, its words, its section, whether it shows. */
export async function quickPiece(id: string, patch: z.input<typeof QuickPiece>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const p = QuickPiece.safeParse(patch);
  if (!p.success) return { error: dict(await getLocale()).common.error };
  const db = await getDb();
  await db.query(
    `update portfolio_items set title = $3, story = $4, published = $5,
            section_id = case when $6 = '' then null else (select id from portfolio_sections where id = $6::uuid and artist_id = portfolio_items.artist_id) end
      where id = $1 and studio_id = $2`,
    [id, member.studioId, p.data.title || null, p.data.story || null, p.data.published, p.data.section_id],
  );
  revalidatePath("/", "layout");
}

/** A city changed, or a new one, from the agenda itself. The timezone follows the previous one, or the home studio's. */
export async function quickStop(id: string | null, values: Record<string, string | boolean>): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const db = await getDb();
  const prev = id ? await db.one<{ timezone: string; is_home: boolean; country: string }>(`select timezone, is_home, country from tour_stops where id = $1 and studio_id = $2`, [id, member.studioId]) : null;
  const home = await db.one<{ timezone: string; country: string }>(`select timezone, country from tour_stops where artist_id = $1 and is_home order by created_at limit 1`, [member.artistId]);
  const form = new FormData();
  if (id) form.set("id", id);
  for (const k of ["city", "studio_name", "address", "starts_on", "ends_on", "status"]) form.set(k, String(values[k] ?? ""));
  form.set("country", String(values.country ?? prev?.country ?? home?.country ?? ""));
  form.set("timezone", prev?.timezone ?? home?.timezone ?? "America/New_York");
  if (prev?.is_home) form.set("is_home", "on");
  const res = await saveStop({ ok: false, message: null }, form);
  revalidatePath("/", "layout");
  return res.ok ? undefined : { error: res.message ?? dict(await getLocale()).common.error };
}

/* ------------------------------------------------------------------ v2: the work editor, the quote confirmation, the finished tattoo */

/** Where the artist centred a piece inside its window and how close (the framing is data, never a cropped file). */
export async function setFraming(itemId: string, framing: { fx: number; fy: number; zoom: number }): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const f = z.object({ fx: z.number().min(0).max(100), fy: z.number().min(0).max(100), zoom: z.number().min(0.4).max(4) }).safeParse(framing);
  if (!f.success) return { error: dict(await getLocale()).common.error };
  const db = await getDb();
  await db.query(`update portfolio_items set focus_x = $3, focus_y = $4, zoom = $5 where id = $1 and studio_id = $2`, [itemId, member.studioId, f.data.fx, f.data.fy, f.data.zoom]);
  revalidatePath("/", "layout");
}

/** A new picture in the place of an old one: same piece, same section, same words. */
export async function replacePiece(itemId: string, uploadToken: string, key: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const draftId = readDraftToken(uploadToken);
  if (!draftId || !(await inspectUpload(draftId, key))) return { error: dict(await getLocale()).common.error };
  const { moveDraftToPublic } = await import("@/lib/storage-move");
  const publicKey = await moveDraftToPublic(key, `portfolio/${member.artistId}`);
  const db = await getDb();
  const old = await db.one<{ image_path: string | null }>(`select image_path from portfolio_items where id = $1 and studio_id = $2`, [itemId, member.studioId]);
  await db.query(`update portfolio_items set image_path = $3, focus_x = 50, focus_y = 50, zoom = 1 where id = $1 and studio_id = $2`, [itemId, member.studioId, publicKey]);
  if (old?.image_path && !old.image_path.startsWith("demo/")) await removeFile("public", old.image_path).catch(() => undefined);
  revalidatePath("/", "layout");
}

/** Photos added straight into one section of the work. */
export async function addPiecesToSection(sectionId: string | null, uploadToken: string, keys: string[]) {
  const member = await requireMember();
  await addPortfolioItems(uploadToken, keys);
  if (!sectionId) return;
  const db = await getDb();
  await db.query(
    `update portfolio_items set section_id = (select id from portfolio_sections where id = $3 and artist_id = $1), published = true
      where artist_id = $1 and studio_id = $2 and section_id is null and created_at > now() - interval '2 minutes'`,
    [member.artistId, member.studioId, sectionId],
  );
  revalidatePath("/", "layout");
}

const Confirm = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.coerce.number().positive().max(14).default(3),
  stopId: z.string().uuid(),
  total: z.coerce.number().positive().max(100000),
  deposit: z.coerce.number().positive().max(100000),
  message: z.string().trim().max(1000).default(""),
});

/**
 * The artist confirms the quote: the date and time they agreed, the total of
 * the piece and the deposit that books it. The client gets the deposit link;
 * the balance (total minus deposit) is what the finished tattoo will ask for.
 */
export async function confirmQuote(briefId: string, input: z.input<typeof Confirm>): Promise<{ error?: string } | void> {
  const t = dict(await getLocale());
  const c = Confirm.safeParse(input);
  if (!c.success) return { error: t.chat.offerForm.invalid };
  if (c.data.deposit > c.data.total) return { error: t.chat.offerForm.depositTooHigh };
  return offerReservation(briefId, { mode: "date", date: c.data.date, time: c.data.time, hours: c.data.hours, stopId: c.data.stopId, price: c.data.total, deposit: c.data.deposit, message: c.data.message });
}

/** The tattoo is done: the balance (total minus deposit) goes to the client as a payment link in the chat. */
export async function finishTattoo(briefId: string): Promise<{ error?: string } | void> {
  const member = await requireMember();
  const db = await getDb();
  const balance = await loadBalance(db, briefId);
  const t = dict(await getLocale());
  if (!balance) return { error: t.common.error };
  if (balance.paid) return { error: t.chat.balance.done };
  if (balance.amountCents === null) {
    const q = await db.one<{ price_min_cents: number; deposit_cents: number }>(`select q.price_min_cents, q.deposit_cents from appointments ap join quotes q on q.id = ap.quote_id where ap.id = $1 and ap.studio_id = $2`, [balance.appointmentId, member.studioId]);
    if (!q) return { error: t.common.error };
    const r = await setBalance(balance.appointmentId, Math.max(0, q.price_min_cents - q.deposit_cents) / 100);
    if (r?.error) return r;
  }
  await db.query(`update appointments set status = 'completed' where id = $1 and studio_id = $2`, [balance.appointmentId, member.studioId]);
  return requestBalance(balance.appointmentId);
}

/** The balance was paid outside the app (cash): mark it so, and send the after-care sheet. */
export async function markBalancePaid(briefId: string): Promise<{ error?: string } | void> {
  await requireMember();
  const db = await getDb();
  const balance = await loadBalance(db, briefId);
  const t = dict(await getLocale());
  if (!balance) return { error: t.common.error };
  if (balance.paid) return { error: t.chat.balance.done };
  await recordBalance(db, { appointmentId: balance.appointmentId, provider: demoMode ? "demo" : "manual", checkoutId: `cash:${balance.appointmentId}`, paymentIntentId: null, amountCents: balance.amountCents ?? 0, currency: balance.currency, feeCents: 0 });
  revalidatePath("/studio", "layout");
}
