import type { Db } from "./db";
import { sign, verify } from "./util";

/**
 * Guests: a visitor who has not made an account still books, chats and saves
 * artists as if they had one. Their account is made the first time they need
 * it (they tap Reservar, follow an artist…) and kept in a signed cookie on
 * their device, so nobody else ever sees their chats. Creating a real account
 * later moves everything over. Guest addresses use the reserved `.invalid`
 * domain, so no mail is ever sent to them.
 */
export const GUEST_COOKIE = "vanta_guest";
const DOMAIN = "invitado.vanta.invalid";

export const guestEmail = (id: string) => `invitado-${id.slice(0, 8)}@${DOMAIN}`;
export const isGuestEmail = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(`@${DOMAIN}`));
export const guestName = (id: string) => `Invitado ${id.slice(0, 4).toUpperCase()}`;

export const sealGuest = (id: string) => `${id}.${sign(`guest:${id}`)}`;
export function readGuest(value: string | undefined | null): string | null {
  const [id, sig] = (value ?? "").split(".");
  return id && sig && /^[0-9a-f-]{36}$/.test(id) && verify(`guest:${id}`, sig) ? id : null;
}

/** The guest's account row, made once. */
export async function ensureGuest(db: Db, id: string, locale: "en" | "es") {
  await db.query(
    `insert into client_users (user_id, email, name, username, locale) values ($1, $2, $3, $4, $5) on conflict (user_id) do nothing`,
    [id, guestEmail(id), guestName(id), `invitado-${id.slice(0, 8)}`, locale],
  );
}

/**
 * A guest made a real account (or signed in to one): their requests, chats,
 * saved artists and visits move to it, and the guest account goes away.
 * Rows the real account already has are kept as they are.
 */
export async function adoptGuest(db: Db, guestId: string, userId: string) {
  if (guestId === userId) return;
  await db.query(`update clients set user_id = $2 where user_id = $1`, [guestId, userId]);
  for (const table of ["follows", "saves", "city_follows", "artist_visits", "push_subscriptions"]) {
    try {
      await db.query(`update ${table} set user_id = $2 where user_id = $1`, [guestId, userId]);
    } catch {
      // The real account already had the same row (a unique pair): keep theirs, drop the guest's.
      await db.query(`delete from ${table} where user_id = $1`, [guestId]).catch(() => undefined);
    }
  }
  await db.query(`delete from client_users where user_id = $1`, [guestId]);
}
