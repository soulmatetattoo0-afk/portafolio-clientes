import { headers } from "next/headers";

/**
 * Small fixed-window limiter for public forms. It lives in server memory, so on
 * serverless it limits per instance: enough to blunt casual abuse. Put
 * Cloudflare Turnstile or an Upstash limiter in front before a big launch.
 */
const g = globalThis as unknown as { __rl?: Map<string, { n: number; reset: number }> };
const buckets = (g.__rl ??= new Map());

export async function allow(action: string, limit: number, windowSeconds: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${action}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowSeconds * 1000 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}
