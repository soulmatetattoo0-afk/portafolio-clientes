import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/auth";
import { env, live } from "@/lib/env";

/** Supabase magic-link landing: trade the one-time code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!live.auth || !code) return NextResponse.redirect(`${env.appUrl}/login?error=link`);
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${env.appUrl}${error ? "/login?error=link" : "/studio"}`);
}
