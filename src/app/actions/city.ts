"use server";

import { cookies } from "next/headers";

import { CITY_COOKIE } from "@/lib/brand";
import { citySlug } from "@/lib/geo";


/** Remember the city the person picked for "near you". A slug only; never coordinates. */
export async function setCity(city: string): Promise<void> {
  const slug = citySlug(String(city ?? "")).slice(0, 60);
  const jar = await cookies();
  if (!slug) jar.delete(CITY_COOKIE);
  else jar.set(CITY_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
}
