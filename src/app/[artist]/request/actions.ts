"use server";

import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getClientUser } from "@/lib/client";
import { STYLE_BY_SLUG } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { enqueueEmail, flushOutbox } from "@/lib/email";
import { briefReceivedToClient, newBriefToArtist } from "@/lib/messages";
import { notify } from "@/lib/push";
import { allow } from "@/lib/ratelimit";
import { MAX_IMAGE_BYTES } from "@/lib/storage";
import { createUploadTargets, inspectUpload, MAX_REFERENCES, readDraftToken, type UploadTarget } from "@/lib/uploads";
import { briefRef } from "@/lib/util";
import { PLACEMENT_BY_SLUG } from "@/mannequin/catalog";

const UploadReq = z
  .array(
    z.object({
      kind: z.enum(["reference", "skin", "placement"]),
      type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
      size: z.number().int().positive().max(MAX_IMAGE_BYTES),
    }),
  )
  .max(MAX_REFERENCES + 2)
  .refine((files) => files.filter((f) => f.kind === "reference").length <= MAX_REFERENCES)
  .refine((files) => files.filter((f) => f.kind !== "reference").length <= 2);

export async function prepareUploads(artistSlug: string, files: unknown): Promise<{ token: string; targets: UploadTarget<"reference" | "skin" | "placement">[] } | { error: string }> {
  const parsed = UploadReq.safeParse(files);
  const t = dict(await getLocale());
  if (!parsed.success) return { error: t.brief.errors.upload };
  if (!(await allow("uploads", 30, 3600))) return { error: t.common.error };
  const db = await getDb();
  const artist = await db.one(`select id from artists where slug = $1 and accepting`, [artistSlug]);
  if (!artist) return { error: t.brief.errors.generic };
  const { token, targets } = await createUploadTargets(parsed.data);
  return { token, targets };
}

const Brief = z
  .object({
    artistSlug: z.string().min(2).max(40),
    style: z.string().refine((s) => STYLE_BY_SLUG.has(s)),
    color: z.enum(["black_grey", "color", "undecided"]),
    body: z.enum(["f", "m"]),
    height: z.number().int().min(140).max(210),
    placement: z.string().refine((s) => PLACEMENT_BY_SLUG.has(s)),
    widthCm: z.number().min(1).max(80).nullable(),
    heightCm: z.number().min(1).max(80).nullable(),
    rotationDeg: z.number().min(-180).max(180),
    point: z.tuple([z.number(), z.number(), z.number()]).nullable(),
    normal: z.tuple([z.number(), z.number(), z.number()]).nullable(),
    description: z.string().trim().min(10).max(4000),
    avoid: z.string().trim().max(2000),
    coverup: z.boolean(),
    firstTattoo: z.boolean(),
    stopId: z.string().uuid().nullable(),
    flashId: z.string().uuid().nullable().default(null),
    timing: z.enum(["asap", "flexible", "specific"]),
    dates: z.string().trim().max(500),
    budgetMin: z.number().int().min(0).max(10_000_000),
    budgetMax: z.number().int().min(0).max(10_000_000).nullable(),
    // Filled from the account on the server; whatever the browser sends here is ignored.
    name: z.string().trim().max(120),
    email: z.string().trim().max(200),
    phone: z.string().trim().max(40),
    instagram: z
      .string()
      .trim()
      .max(60)
      .transform((v) => v.replace(/^@/, "")),
    adult: z.literal(true),
    attribution: z.record(z.string(), z.string().max(300)).default({}),
    uploadToken: z.string().nullable(),
    uploads: z.array(z.object({ key: z.string().max(200), kind: z.enum(["reference", "skin", "placement"]) })).max(MAX_REFERENCES + 2),
  })
  .refine((b) => b.budgetMax === null || b.budgetMax >= b.budgetMin);

export type BriefInput = z.input<typeof Brief>;
export type SubmitResult = { ok: true; ref: string; chat: string } | { ok: false; error: string };

export async function submitBrief(input: BriefInput): Promise<SubmitResult> {
  const locale = await getLocale();
  const t = dict(locale);
  const parsed = Brief.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.brief.errors.generic };
  if (!(await allow("brief", 6, 3600))) return { ok: false, error: t.common.error };
  const b = parsed.data;
  // Every request comes from an account: its chat lives in the person's space.
  const me = await getClientUser();
  if (!me) return { ok: false, error: t.brief.contact.accountRequired };
  b.email = me.email.toLowerCase();
  b.name = me.name?.trim() || me.email.split("@")[0];
  const db = await getDb();

  const artist = await db.one<{ id: string; studio_id: string; display_name: string; accepting: boolean; currency: string; owner_email: string | null; owner_locale: "en" | "es" | null }>(
    `select a.id, a.studio_id, a.display_name, a.accepting, a.currency,
            (select m.email from members m where m.studio_id = a.studio_id order by (m.role = 'owner') desc limit 1) as owner_email,
            (select m.locale from members m where m.studio_id = a.studio_id order by (m.role = 'owner') desc limit 1) as owner_locale
       from artists a where a.slug = $1`,
    [b.artistSlug],
  );
  if (!artist) return { ok: false, error: t.brief.errors.generic };
  if (!artist.accepting) return { ok: false, error: fill(t.brief.errors.closed, { artist: artist.display_name }) };

  if (b.stopId) {
    const stop = await db.one(`select id from tour_stops where id = $1 and artist_id = $2`, [b.stopId, artist.id]);
    if (!stop) return { ok: false, error: t.brief.errors.generic };
  }
  // A flash design only counts when it belongs to this artist and is still on offer.
  const flashId = b.flashId ? ((await db.one(`select id from flash_designs where id = $1 and artist_id = $2 and published`, [b.flashId, artist.id])) ? b.flashId : null) : null;

  // Only accept files uploaded under this brief's own signed draft.
  const draftId = b.uploadToken ? readDraftToken(b.uploadToken) : null;
  const files: { key: string; kind: string; mime: string; bytes: number }[] = [];
  if (b.uploads.length) {
    if (!draftId) return { ok: false, error: t.brief.errors.upload };
    for (const u of b.uploads) {
      const info = await inspectUpload(draftId, u.key);
      if (!info) return { ok: false, error: t.brief.errors.upload };
      files.push({ key: u.key, kind: u.kind, ...info });
    }
  }

  const placement = PLACEMENT_BY_SLUG.get(b.placement)!;
  const full = placement.fullCoverage;
  // A signed-in person sending under their own email owns the client record the brief lands on.
  const userId = me.userId;

  const result = await db.tx(async (tx) => {
    const client = await tx.one<{ id: string }>(
      `insert into clients (studio_id, name, email, phone, instagram, locale, user_id) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (studio_id, lower(email)) do update set name = excluded.name,
         phone = coalesce(nullif(excluded.phone, ''), clients.phone),
         instagram = coalesce(nullif(excluded.instagram, ''), clients.instagram),
         locale = excluded.locale,
         user_id = coalesce(clients.user_id, excluded.user_id)
       returning id`,
      [artist.studio_id, b.name, b.email, b.phone || null, b.instagram || null, locale, userId],
    );
    let ref = briefRef();
    for (let i = 0; i < 4; i++) {
      const clash = await tx.one(`select 1 from briefs where ref = $1`, [ref]);
      if (!clash) break;
      ref = briefRef();
    }
    const brief = await tx.one<{ id: string; chat_token: string }>(
      `insert into briefs (studio_id, artist_id, client_id, ref, style, color_mode, placement, full_coverage, body, body_height_cm,
          size_w_cm, size_h_cm, placement_detail, description, avoid, is_coverup, is_first_tattoo,
          budget_min_cents, budget_max_cents, currency, timing, preferred_dates, tour_stop_id, attribution, flash_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
       returning id, chat_token`,
      [
        artist.studio_id, artist.id, client!.id, ref, b.style, b.color, b.placement, full, b.body, b.height,
        full ? null : b.widthCm, full ? null : b.heightCm,
        JSON.stringify(full || !b.point ? {} : { point: b.point, normal: b.normal, rotation_deg: b.rotationDeg }),
        b.description, b.avoid || null, b.coverup, b.firstTattoo,
        b.budgetMin, b.budgetMax, artist.currency, b.timing, b.timing === "specific" ? b.dates || null : null, b.stopId,
        JSON.stringify(b.attribution), flashId,
      ],
    );
    for (const f of files) {
      await tx.query(`insert into brief_files (studio_id, brief_id, kind, path, mime, bytes) values ($1, $2, $3, $4, $5, $6)`, [
        artist.studio_id, brief!.id, f.kind, f.key, f.mime, f.bytes,
      ]);
    }
    await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor) values ($1, $2, 'created', 'client')`, [artist.studio_id, brief!.id]);
    return { briefId: brief!.id, ref, chat: brief!.chat_token };
  });

  const summary = {
    ref: result.ref,
    placement: b.placement,
    full_coverage: full,
    size_w_cm: b.widthCm,
    size_h_cm: b.heightCm,
    style: b.style,
    color_mode: b.color,
    budget_min_cents: b.budgetMin,
    budget_max_cents: b.budgetMax,
    currency: artist.currency,
  };
  await enqueueEmail(db, briefReceivedToClient({ to: b.email, artist: artist.display_name, client: b.name, brief: summary, locale, chatToken: result.chat }), {
    studioId: artist.studio_id,
    template: "brief_received",
    dedupeKey: `brief-received:${result.briefId}`,
  });
  if (artist.owner_email) {
    await enqueueEmail(
      db,
      newBriefToArtist({ to: artist.owner_email, artist: artist.display_name, client: b.name, brief: summary, briefId: result.briefId, locale: artist.owner_locale ?? "en" }),
      { studioId: artist.studio_id, template: "new_brief", dedupeKey: `new-brief:${result.briefId}` },
    );
  }
  const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [artist.studio_id]);
  after(async () => {
    await flushOutbox(await getDb());
    await notify(members.map((m) => m.user_id), {
      title: fill(dict(members[0]?.locale ?? "en").push.newRequest, { name: b.name }),
      body: b.description,
      url: `/studio?brief=${result.briefId}`,
      tag: `chat:${result.briefId}`,
    });
  });
  return { ok: true, ref: result.ref, chat: result.chat };
}
