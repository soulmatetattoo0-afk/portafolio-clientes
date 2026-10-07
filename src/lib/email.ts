import { Resend } from "resend";

import type { Db } from "./db";
import { env, live } from "./env";

export interface EmailBlock {
  heading?: string;
  paragraphs?: string[];
  rows?: [string, string][];
  cta?: { label: string; href: string };
  note?: string;
}

export interface Email {
  to: string;
  subject: string;
  preheader?: string;
  blocks: EmailBlock[];
  footer: string;
  replyTo?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain, legible HTML that survives every mail client: one column, inline styles. */
export function renderEmail(email: Email) {
  const body = email.blocks
    .map((b) => {
      const parts: string[] = [];
      if (b.heading) parts.push(`<h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:#1c1813;margin:0 0 16px">${esc(b.heading)}</h1>`);
      for (const p of b.paragraphs ?? []) parts.push(`<p style="margin:0 0 14px;line-height:1.6;color:#3b342b;white-space:pre-line">${esc(p)}</p>`);
      if (b.rows?.length) {
        parts.push(
          `<table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 18px">${b.rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #e6dfd2;color:#8a7f6e;font-size:13px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #e6dfd2;color:#1c1813;vertical-align:top">${esc(v)}</td></tr>`,
            )
            .join("")}</table>`,
        );
      }
      if (b.cta) {
        parts.push(
          `<p style="margin:8px 0 22px"><a href="${esc(b.cta.href)}" style="display:inline-block;background:#1c1813;color:#f3ead8;text-decoration:none;padding:13px 20px;border-radius:4px;font-weight:600">${esc(b.cta.label)}</a></p>`,
        );
      }
      if (b.note) parts.push(`<p style="margin:0 0 14px;font-size:13px;color:#8a7f6e;line-height:1.5">${esc(b.note)}</p>`);
      return parts.join("");
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe6;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px">
<span style="display:none;max-height:0;overflow:hidden">${esc(email.preheader ?? "")}</span>
<div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e6dfd2;border-radius:6px;padding:32px 28px">${body}</div>
<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#8a7f6e;text-align:center">${esc(email.footer)}</p></body></html>`;
  const text = email.blocks
    .map((b) =>
      [b.heading, ...(b.paragraphs ?? []), ...(b.rows ?? []).map(([k, v]) => `${k}: ${v}`), b.cta ? `${b.cta.label}: ${b.cta.href}` : "", b.note]
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n");
  return { html, text: `${text}\n\n--\n${email.footer}` };
}

export async function enqueueEmail(
  db: Db,
  email: Email,
  opts: { studioId?: string | null; template: string; sendAfter?: Date; dedupeKey?: string },
) {
  const { html, text } = renderEmail(email);
  await db.query(
    `insert into outbox (studio_id, to_email, reply_to, subject, html, text_body, template, send_after, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (dedupe_key) do nothing`,
    [
      opts.studioId ?? null,
      email.to,
      email.replyTo ?? null,
      email.subject,
      html,
      text,
      opts.template,
      (opts.sendAfter ?? new Date()).toISOString(),
      opts.dedupeKey ?? null,
    ],
  );
}

/** Send what's due. Called right after a request that queued mail, and by the cron route. */
export async function flushOutbox(db: Db, limit = 25) {
  const due = await db.query<{ id: string; to_email: string; reply_to: string | null; subject: string; html: string; text_body: string }>(
    `select id, to_email, reply_to, subject, html, text_body from outbox
      where sent_at is null and send_after <= now() and attempts < 5
      order by send_after limit $1`,
    [limit],
  );
  const resend = live.email ? new Resend(env.resendApiKey) : null;
  let sent = 0;
  for (const m of due) {
    try {
      if (resend) {
        const { error } = await resend.emails.send({
          from: env.emailFrom,
          to: m.to_email,
          replyTo: m.reply_to ?? undefined,
          subject: m.subject,
          html: m.html,
          text: m.text_body,
        });
        if (error) throw new Error(error.message);
      } else {
        console.info(`[email:demo] to=${m.to_email} subject="${m.subject}"`);
      }
      await db.query(`update outbox set sent_at = now(), attempts = attempts + 1 where id = $1`, [m.id]);
      sent++;
    } catch (e) {
      await db.query(`update outbox set attempts = attempts + 1, last_error = $2 where id = $1`, [m.id, String(e).slice(0, 500)]);
    }
  }
  return sent;
}
