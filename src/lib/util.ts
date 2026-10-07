import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "./env";

/** Unguessable token for links clients open without an account (quotes). */
export const token = (bytes = 24) => randomBytes(bytes).toString("base64url");

/** Short reference a client can read over the phone: "B-7KQ4". No 0/O/1/I. */
export function briefRef() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = randomBytes(5);
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[b[i] % alphabet.length];
  return `B-${s}`;
}

export function sign(value: string) {
  return createHmac("sha256", env.appSecret).update(value).digest("base64url");
}

export function verify(value: string, signature: string) {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
