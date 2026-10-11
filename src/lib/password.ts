import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Local accounts only (production passwords live in Supabase Auth): scrypt with a random salt. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function checkPassword(pw: string, stored: string | null): Promise<boolean> {
  const [kind, salt, key] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64url");
  const got = await scrypt(pw, Buffer.from(salt, "base64url"), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}
