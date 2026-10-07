"use server";

import { z } from "zod";

import { dict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getDb } from "@/lib/db";
import { allow } from "@/lib/ratelimit";

export interface LeadState {
  ok: boolean;
  error: string | null;
}

const Lead = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  instagram: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v.replace(/^@/, ""))
    .optional(),
  city: z.string().trim().max(80).optional(),
});

export async function requestAccess(_prev: LeadState, form: FormData): Promise<LeadState> {
  const locale = await getLocale();
  const parsed = Lead.safeParse({
    email: form.get("email"),
    instagram: form.get("instagram") || undefined,
    city: form.get("city") || undefined,
  });
  if (!parsed.success) return { ok: false, error: dict(locale).brief.contact.emailInvalid };
  if (!(await allow("lead", 5, 3600))) return { ok: false, error: dict(locale).common.error };
  const db = await getDb();
  await db.query(
    `insert into artist_leads (email, instagram, city, locale) values ($1, $2, $3, $4)
     on conflict (lower(email)) do update set instagram = coalesce(excluded.instagram, artist_leads.instagram), city = coalesce(excluded.city, artist_leads.city)`,
    [parsed.data.email, parsed.data.instagram ?? null, parsed.data.city ?? null, locale],
  );
  return { ok: true, error: null };
}
