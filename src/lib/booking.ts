import type { Locale } from "@/i18n";

import type { Db } from "./db";
import { enqueueEmail } from "./email";
import { bookedToArtist, bookedToClient, reminderToClient, type BookingInfo } from "./messages";

export class SlotTakenError extends Error {
  constructor() {
    super("slot_taken");
  }
}

interface ConfirmArgs {
  quoteId: string;
  slotId: string;
  provider: "stripe" | "demo";
  checkoutId: string;
  paymentIntentId?: string | null;
  amountCents: number;
  currency: string;
  feeCents?: number;
}

/**
 * Turn a paid deposit into a confirmed appointment. Idempotent per checkout:
 * Stripe may deliver the same webhook twice, and the demo button can be double-clicked.
 * If the slot was taken in the meantime the payment is still recorded and the
 * artist is told to agree a new date, because the client's money has moved.
 */
export async function confirmBooking(db: Db, a: ConfirmArgs): Promise<{ appointmentId: string | null; slotTaken: boolean }> {
  const result = await db.tx(async (tx) => {
    const existing = await tx.one<{ appointment_id: string | null }>(`select appointment_id from payments where checkout_id = $1 and status = 'paid'`, [a.checkoutId]);
    if (existing) return { appointmentId: existing.appointment_id, slotTaken: false, fresh: false };

    const q = await tx.one<{
      id: string;
      studio_id: string;
      brief_id: string;
      artist_id: string;
      status: string;
      client_id: string;
    }>(
      `select q.id, q.studio_id, q.brief_id, q.artist_id, q.status, b.client_id
         from quotes q join briefs b on b.id = q.brief_id where q.id = $1 for update of q`,
      [a.quoteId],
    );
    if (!q) throw new Error("quote_not_found");

    const slot = await tx.one<{ id: string; starts_at: Date; ends_at: Date; timezone: string; status: string; city: string | null }>(
      `select s.id, s.starts_at, s.ends_at, s.timezone, s.status, t.city
         from quote_slots s left join tour_stops t on t.id = s.tour_stop_id
        where s.id = $1 and s.quote_id = $2 for update of s`,
      [a.slotId, a.quoteId],
    );

    let appointmentId: string | null = null;
    let slotTaken = !slot || !["offered", "held"].includes(slot.status) || q.status === "paid";
    if (!slotTaken && slot) {
      // A savepoint keeps the transaction usable if the overlap constraint fires.
      await tx.query("savepoint appointment_insert");
      try {
        const row = await tx.one<{ id: string }>(
          `insert into appointments (studio_id, artist_id, client_id, brief_id, quote_id, slot_id, starts_at, ends_at, timezone, city)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [q.studio_id, q.artist_id, q.client_id, q.brief_id, q.id, slot.id, slot.starts_at, slot.ends_at, slot.timezone, slot.city],
        );
        appointmentId = row!.id;
        await tx.query("release savepoint appointment_insert");
      } catch (e) {
        if (!String(e).includes("appointments_no_overlap")) throw e;
        await tx.query("rollback to savepoint appointment_insert");
        slotTaken = true;
      }
    }

    await tx.query(
      `insert into payments (studio_id, quote_id, appointment_id, provider, checkout_id, payment_intent_id, amount_cents, application_fee_cents, currency, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'paid')
       on conflict (checkout_id) do update set status = 'paid', appointment_id = excluded.appointment_id, payment_intent_id = excluded.payment_intent_id`,
      [q.studio_id, q.id, appointmentId, a.provider, a.checkoutId, a.paymentIntentId ?? null, a.amountCents, a.feeCents ?? 0, a.currency],
    );

    if (appointmentId) {
      await tx.query(`update quote_slots set status = 'booked', hold_expires_at = null where id = $1`, [a.slotId]);
      await tx.query(`update quote_slots set status = 'released' where quote_id = $1 and id <> $2 and status in ('offered', 'held')`, [q.id, a.slotId]);
      await tx.query(`update quotes set status = 'paid' where id = $1`, [q.id]);
      await tx.query(`update briefs set status = 'booked', updated_at = now() where id = $1`, [q.brief_id]);
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, data) values ($1, $2, 'paid', 'client', $3)`, [
        q.studio_id,
        q.brief_id,
        JSON.stringify({ amount_cents: a.amountCents, currency: a.currency, appointment_id: appointmentId }),
      ]);
    } else {
      await tx.query(`insert into brief_events (studio_id, brief_id, kind, actor, body, data) values ($1, $2, 'note', 'system', $3, $4)`, [
        q.studio_id,
        q.brief_id,
        "Deposit paid but the chosen date was no longer free. Agree a new date with the client.",
        JSON.stringify({ amount_cents: a.amountCents, currency: a.currency }),
      ]);
    }
    return { appointmentId, slotTaken, fresh: true };
  });

  if (result.fresh && result.appointmentId) await queueBookingEmails(db, result.appointmentId);
  return { appointmentId: result.appointmentId, slotTaken: result.slotTaken };
}

async function queueBookingEmails(db: Db, appointmentId: string) {
  const r = await db.one<{
    studio_id: string;
    brief_id: string;
    starts_at: Date;
    timezone: string;
    city: string | null;
    studio_name: string | null;
    address: string | null;
    artist: string;
    client: string;
    client_email: string;
    client_locale: Locale;
    artist_email: string | null;
    artist_locale: Locale | null;
    amount_cents: number;
    currency: string;
    token: string;
  }>(
    `select ap.studio_id, ap.brief_id, ap.starts_at, ap.timezone, ap.city, t.studio_name, t.address,
            ar.display_name as artist, c.name as client, c.email as client_email, c.locale as client_locale,
            (select m.email from members m where m.studio_id = ap.studio_id order by (m.role = 'owner') desc limit 1) as artist_email,
            (select m.locale from members m where m.studio_id = ap.studio_id order by (m.role = 'owner') desc limit 1) as artist_locale,
            p.amount_cents, p.currency, q.token
       from appointments ap
       join artists ar on ar.id = ap.artist_id
       join clients c on c.id = ap.client_id
       join quotes q on q.id = ap.quote_id
       join payments p on p.appointment_id = ap.id
       left join quote_slots s on s.id = ap.slot_id
       left join tour_stops t on t.id = s.tour_stop_id
      where ap.id = $1`,
    [appointmentId],
  );
  if (!r) return;
  const info: BookingInfo = {
    artist: r.artist,
    client: r.client,
    startsAt: new Date(r.starts_at),
    timezone: r.timezone,
    city: r.city,
    studioName: r.studio_name,
    address: r.address,
    deposit: r.amount_cents,
    currency: r.currency,
    token: r.token,
  };
  await enqueueEmail(db, bookedToClient(r.client_email, info, r.client_locale), { studioId: r.studio_id, template: "booked_client", dedupeKey: `booked:${appointmentId}` });
  if (r.artist_email) {
    await enqueueEmail(db, bookedToArtist(r.artist_email, info, r.brief_id, r.artist_locale ?? "en"), { studioId: r.studio_id, template: "booked_artist", dedupeKey: `booked-artist:${appointmentId}` });
  }
  for (const days of [3, 1] as const) {
    const at = new Date(info.startsAt.getTime() - days * 24 * 3600 * 1000);
    if (at.getTime() > Date.now()) {
      await enqueueEmail(db, reminderToClient(r.client_email, info, days, r.client_locale), {
        studioId: r.studio_id,
        template: `reminder_${days}d`,
        sendAfter: at,
        dedupeKey: `reminder${days}:${appointmentId}`,
      });
    }
  }
}
