import { after } from "next/server";

import { dict, fill, type Locale } from "@/i18n";

import type { Db } from "./db";
import { enqueueEmail, flushOutbox, type Email } from "./email";
import { env } from "./env";

/**
 * The chat's email: until VANTA is an app on the phones, email is how people
 * hear that the other side wrote. Rules, so a lively chat never floods an inbox:
 * - whoever is inside the app right now (seen in the last two minutes) gets no email;
 * - plain messages: at most one email per conversation every ten minutes;
 * - the steps that matter (the quote, the booking request, the payment link,
 *   the payment received) always get their own email, unless the person is in the app.
 */
export type ChatMoment = "message" | "offer" | "bookRequest" | "payLink" | "paid";

const ONLINE_SECONDS = 120;
const QUIET_MINUTES = 10;

export async function emailChat(db: Db, briefId: string, to: "client" | "artist", moment: ChatMoment, text: string | null) {
  const b = await db.one<{ studio_id: string; chat_token: string; client_name: string; client_email: string | null; client_locale: Locale; client_online: boolean; artist_name: string; artist_slug: string }>(
    `select b.studio_id, b.chat_token, c.name as client_name, c.email as client_email, c.locale as client_locale, a.display_name as artist_name, a.slug as artist_slug,
            coalesce((select cu.last_seen_at > now() - make_interval(secs => $2) from client_users cu where cu.user_id = c.user_id), false) as client_online
       from briefs b join clients c on c.id = b.client_id join artists a on a.id = b.artist_id where b.id = $1`,
    [briefId, ONLINE_SECONDS],
  );
  if (!b) return;
  const bucket = Math.floor(Date.now() / (QUIET_MINUTES * 60_000));
  const key = (who: string) => (moment === "message" ? `chat:${briefId}:${who}:${bucket}` : `chat:${briefId}:${who}:${moment}:${Date.now()}`);
  const queued: Promise<unknown>[] = [];
  if (to === "client") {
    if (!b.client_email || b.client_online) return;
    queued.push(enqueueEmail(db, toClient(b.client_email, b.client_locale, b.artist_name, b.artist_slug, b.chat_token, moment, text), { studioId: b.studio_id, template: `chat_${moment}`, dedupeKey: key("client") }));
  } else {
    const members = await db.query<{ email: string; locale: Locale; online: boolean }>(
      `select email, locale, coalesce(last_seen_at > now() - make_interval(secs => $2), false) as online from members where studio_id = $1`,
      [b.studio_id, ONLINE_SECONDS],
    );
    for (const m of members) {
      if (m.online || !m.email) continue;
      queued.push(enqueueEmail(db, toArtist(m.email, m.locale ?? "es", b.artist_name, b.client_name, briefId, moment, text), { studioId: b.studio_id, template: `chat_${moment}`, dedupeKey: key(m.email) }));
    }
  }
  if (!queued.length) return;
  await Promise.all(queued);
  try {
    after(async () => {
      const { getDb } = await import("./db");
      await flushOutbox(await getDb());
    });
  } catch {
    /* outside a request: the daily cron sends it */
  }
}

function toClient(to: string, locale: Locale, artist: string, slug: string, chatToken: string, moment: ChatMoment, text: string | null): Email {
  const t = dict(locale).chat.email;
  const subject = moment === "offer" ? t.offerSubject : moment === "payLink" ? t.payLinkSubject : moment === "paid" ? t.bookedSubject : t.toClientSubject;
  const lead = moment === "offer" ? t.offerLead : moment === "payLink" ? t.payLinkLead : moment === "paid" ? t.bookedLead : t.messageLead;
  return {
    to,
    subject: fill(subject, { artist }),
    preheader: text ?? fill(lead, { artist }),
    // The button signs the client in (if this device isn't already) and lands them on this conversation; the artist's page is one link below.
    blocks: [
      { heading: fill(subject, { artist }), paragraphs: [fill(lead, { artist }), text ?? ""].filter(Boolean), cta: { label: t.open, href: `${env.appUrl}/me/signin?mode=enter&next=${encodeURIComponent(`/c/${chatToken}`)}` } },
      { paragraphs: [`${fill(t.artistPage, { artist })}: ${env.appUrl}/${slug}`], note: t.quietNote },
    ],
    footer: fill(dict(locale).email.footer, { artist }),
  };
}

function toArtist(to: string, locale: Locale, artist: string, client: string, briefId: string, moment: ChatMoment, text: string | null): Email {
  const t = dict(locale).chat.email;
  const subject = moment === "bookRequest" ? t.bookRequestSubject : moment === "paid" ? t.paidSubject : t.toArtistSubject;
  return {
    to,
    subject: fill(subject, { name: client }),
    preheader: text ?? fill(subject, { name: client }),
    blocks: [{ heading: fill(subject, { name: client }), paragraphs: [text ?? ""].filter(Boolean), cta: { label: t.open, href: `${env.appUrl}/studio/chats/${briefId}` }, note: t.quietNote }],
    footer: fill(dict(locale).email.footer, { artist }),
  };
}
