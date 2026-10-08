import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/i18n";
import { supabaseServer } from "@/lib/auth";
import { ensureClientUser, safeNext } from "@/lib/client";
import { env, live } from "@/lib/env";

/**
 * Supabase magic-link and OAuth landing: trade the one-time code for a session
 * cookie. An artist goes to the studio; a client (intent=client) gets their
 * account row on first arrival and goes back to where they were headed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const client = url.searchParams.get("intent") === "client";
  const next = safeNext(url.searchParams.get("next"));
  const failed = client ? `/me/signin?error=link&next=${encodeURIComponent(next)}` : "/login?error=link";
  if (!live.auth || !code) return NextResponse.redirect(`${env.appUrl}${failed}`);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${env.appUrl}${failed}`);
  if (!client) return NextResponse.redirect(`${env.appUrl}/studio`);
  const lang = (await cookies()).get(LOCALE_COOKIE)?.value;
  await ensureClientUser(data.user.id, data.user.email ?? "", lang === "es" ? "es" : "en");
  return NextResponse.redirect(`${env.appUrl}${next}`);
}
