"use server";

import { redirect } from "next/navigation";

import { setDevSession, signOut } from "@/lib/auth";
import { DEMO_EMAIL, DEMO_USER_ID, live, SOVA_EMAIL, SOVA_USER_ID } from "@/lib/env";

/** Local mode only: sign in as the seeded demo artist. */
export async function enterDemo() {
  if (live.auth) redirect("/login");
  await setDevSession(DEMO_USER_ID, DEMO_EMAIL);
  redirect("/studio");
}

/** Local mode only: sign in as TATTOO BY SOVA. */
export async function enterSova() {
  if (live.auth || process.env.VERCEL) redirect("/login");
  await setDevSession(SOVA_USER_ID, SOVA_EMAIL);
  redirect("/studio/pagina");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
