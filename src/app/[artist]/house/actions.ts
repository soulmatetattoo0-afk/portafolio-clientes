"use server";

import { after } from "next/server";
import { z } from "zod";

import { dict, fill } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { notifyEach } from "@/lib/push";
import { allow } from "@/lib/ratelimit";
import { createUploadTargets, inspectUpload, readDraftToken, type UploadTarget } from "@/lib/uploads";

const MAX_WORK = 6;

/** Signed targets for the applicant's portfolio photos, straight from the browser to storage. */
export async function prepareJoinUploads(studioSlug: string, files: unknown): Promise<{ token: string; targets: UploadTarget<"reference">[] } | { error: string }> {
  const t = dict(await getLocale());
  const parsed = z.array(z.object({ kind: z.literal("reference"), type: z.string().max(60), size: z.number().int().positive().max(25_000_000) })).max(MAX_WORK).safeParse(files);
  if (!parsed.success) return { error: t.house.join.errorUpload };
  if (!(await allow("join-uploads", 20, 3600))) return { error: t.common.error };
  const db = await getDb();
  const studio = await db.one(`select id from studios where slug = $1 and kind = 'studio'`, [studioSlug]);
  if (!studio) return { error: t.common.error };
  return createUploadTargets(parsed.data);
}

const Application = z.object({
  studioSlug: z.string().min(2).max(40),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  years: z.coerce.number().int().min(0).max(60),
  role: z.enum(["guest", "resident"]),
  message: z.string().trim().max(2000).optional().default(""),
  links: z.array(z.string().trim().url().max(400)).max(6).default([]),
  uploadToken: z.string().nullable(),
  files: z.array(z.string().max(300)).max(MAX_WORK).default([]),
});

/** An artist asks to join the studio, as a guest or a resident. The studio hears on its phones. */
export async function applyToStudio(input: z.input<typeof Application>): Promise<{ ok: true } | { error: string }> {
  const t = dict(await getLocale());
  const parsed = Application.safeParse(input);
  if (!parsed.success) return { error: t.house.join.errorFields };
  const a = parsed.data;
  if (!(await allow(`join:${a.email.toLowerCase()}`, 3, 24 * 3600))) return { error: t.common.error };
  const db = await getDb();
  const studio = await db.one<{ id: string; name: string }>(`select id, name from studios where slug = $1 and kind = 'studio'`, [a.studioSlug]);
  if (!studio) return { error: t.common.error };
  const draftId = a.uploadToken ? readDraftToken(a.uploadToken) : null;
  const files: string[] = [];
  if (draftId) for (const key of a.files) if (await inspectUpload(draftId, key)) files.push(key);
  await db.query(
    `insert into studio_applications (studio_id, name, email, years, role, message, links, files) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [studio.id, a.name, a.email.toLowerCase(), a.years, a.role, a.message || null, a.links, files],
  );
  const members = await db.query<{ user_id: string; locale: "en" | "es" }>(`select user_id, locale from members where studio_id = $1`, [studio.id]);
  after(() =>
    notifyEach(members, (l) => ({
      title: fill(dict(l).house.join.push, { name: a.name }),
      body: `${dict(l).house.join[a.role]} · ${a.years} ${dict(l).house.join.yearsShort}`,
      url: "/studio/applications",
      tag: `join:${studio.id}`,
    })),
  );
  return { ok: true };
}
