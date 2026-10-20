import { getDict } from "@/i18n/server";
import { getMember, getSession, requireMember } from "@/lib/auth";
import { loadCaja } from "@/lib/caja";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { live } from "@/lib/env";
import { getArtistById } from "@/lib/queries";

/** The month's Caja as a spreadsheet (CSV): every deposit, session and expense, for the accountant. */
export async function GET(request: Request) {
  // Signed out, or not an artist: back to the sign-in, as a plain redirect (no page to render here).
  const member = live.auth ? await getMember(await getSession()) : await requireMember();
  if (!member) return Response.redirect(new URL("/login", request.url), 303);
  const m = new URL(request.url).searchParams.get("m") ?? "";
  const key = /^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7);
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  const c = t.v2.caja;
  const data = await loadCaja(await getDb(), member.studioId, member.artistId, key);
  const currency = (artist?.currency ?? "usd").toUpperCase();
  const amount = (cents: number) => (cents / 100).toFixed(2);
  const rows: string[][] = [
    [c.csv.date, c.csv.type, c.csv.who, c.csv.detail, c.csv.amount, c.csv.currency],
    ...data.pays.map((p) => [p.day, p.kind === "deposit" ? c.deposit : c.session, p.who, p.style ? styleLabel(p.style, locale) : "", amount(p.cents), currency]),
    ...data.exps.map((e) => [e.day, c.expenses, e.who, c.category[e.category as keyof typeof c.category] ?? e.category, amount(-e.cents), currency]),
  ];
  const body = [rows[0], ...rows.slice(1).sort((a, b) => a[0].localeCompare(b[0]))]
    .map((r) => r.map((v) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
    .join("\r\n");
  // The byte-order mark lets Excel read the accents.
  return new Response(`﻿${body}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="caja-${key}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
