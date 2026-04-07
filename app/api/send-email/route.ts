import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'soulmate.tattoo0@gmail.com'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'hello@soulmatetattoo.com'

function formatBookingDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function buildClientConfirmationEmail(data: {
  clientName: string
  bookingDate: string
  paymentIntentId: string
  bookingId: string
  description: string
}): string {
  const formattedDate = formatBookingDate(data.bookingDate)
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmation — Soulmate Tattoo</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:40px;border-bottom:1px solid #2A2A2A;">
              <p style="font-family:Georgia,serif;font-size:28px;font-weight:300;letter-spacing:0.3em;color:#DADADA;margin:0 0 8px 0;">
                SOULMATE TATTOO
              </p>
              <p style="font-size:11px;letter-spacing:0.3em;color:#C9A84C;margin:0;text-transform:uppercase;">
                Realism &amp; Surrealism
              </p>
            </td>
          </tr>

          <!-- Confirmation message -->
          <tr>
            <td style="padding:40px 0 32px 0;">
              <p style="font-size:11px;letter-spacing:0.3em;color:#C9A84C;margin:0 0 16px 0;text-transform:uppercase;">
                Booking Confirmed
              </p>
              <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#DADADA;margin:0 0 24px 0;line-height:1.2;">
                Your session is secured, ${data.clientName.split(' ')[0]}.
              </h1>
              <p style="font-size:14px;line-height:1.8;color:#888888;margin:0;">
                Thank you for booking with Soulmate Tattoo. Your reservation has been confirmed
                and Camo will be in touch shortly to discuss the details of your tattoo.
              </p>
            </td>
          </tr>

          <!-- Booking details card -->
          <tr>
            <td style="background-color:#161616;border:1px solid #2A2A2A;padding:32px;">
              <p style="font-family:Georgia,serif;font-size:20px;font-weight:300;color:#DADADA;margin:0 0 24px 0;">
                Booking Details
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A2A2A;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Date</p>
                    <p style="font-size:14px;color:#DADADA;margin:0;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A2A2A;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Artist</p>
                    <p style="font-size:14px;color:#DADADA;margin:0;">Camo</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A2A2A;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Reservation Fee</p>
                    <p style="font-size:20px;font-family:Georgia,serif;color:#C9A84C;margin:0;">€50.00 paid</p>
                  </td>
                </tr>
                ${data.description ? `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A2A2A;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Your Description</p>
                    <p style="font-size:13px;color:#888888;margin:0;line-height:1.6;">${data.description}</p>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding:12px 0;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Reference</p>
                    <p style="font-size:11px;color:#555555;margin:0;font-family:monospace;">${data.paymentIntentId}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Important info -->
          <tr>
            <td style="padding:32px 0;">
              <p style="font-family:Georgia,serif;font-size:18px;font-weight:300;color:#DADADA;margin:0 0 16px 0;">
                What to expect next
              </p>
              <ul style="padding:0;margin:0;list-style:none;">
                ${[
                  'Camo will review your tattoo description and reach out within 48 hours.',
                  'The studio is open 12PM – 7PM. Final timing will be confirmed via email.',
                  'The €50 reservation fee is deducted from the total session cost.',
                  'Bring any reference images to your consultation.',
                ].map(item => `
                <li style="display:flex;align-items:flex-start;margin-bottom:12px;">
                  <span style="color:#C9A84C;margin-right:12px;flex-shrink:0;">—</span>
                  <span style="font-size:13px;color:#888888;line-height:1.6;">${item}</span>
                </li>
                `).join('')}
              </ul>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 0 40px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
                style="display:inline-block;background-color:#C9A84C;color:#080808;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;font-weight:600;">
                View My Bookings
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #2A2A2A;padding-top:32px;">
              <p style="font-size:12px;color:#555555;margin:0 0 8px 0;">Soulmate Tattoo · Dublin, Ireland</p>
              <p style="font-size:11px;color:#444444;margin:0;">
                Questions? Reply to this email or visit
                <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#C9A84C;text-decoration:none;">soulmatetattoo.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function buildAdminNotificationEmail(data: {
  clientName: string
  clientEmail: string
  bookingDate: string
  paymentIntentId: string
  bookingId: string
  description: string
}): string {
  const formattedDate = formatBookingDate(data.bookingDate)
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>New Booking — Soulmate Tattoo</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #2A2A2A;">
              <p style="font-family:Georgia,serif;font-size:24px;font-weight:300;letter-spacing:0.3em;color:#DADADA;margin:0 0 8px 0;">
                SOULMATE TATTOO
              </p>
              <p style="font-size:11px;letter-spacing:0.3em;color:#C9A84C;margin:0;text-transform:uppercase;">
                Admin Notification
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0 24px 0;">
              <h2 style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#DADADA;margin:0 0 8px 0;">
                New Booking Received
              </h2>
              <p style="font-size:13px;color:#888888;margin:0;">
                A new booking has been confirmed with payment.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#161616;border:1px solid #2A2A2A;padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  { label: 'Client Name', value: data.clientName },
                  { label: 'Client Email', value: data.clientEmail },
                  { label: 'Session Date', value: formattedDate },
                  { label: 'Amount Paid', value: '€50.00' },
                  { label: 'Stripe Payment ID', value: data.paymentIntentId },
                  { label: 'Booking ID', value: data.bookingId },
                ].map(item => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2A2A;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">${item.label}</p>
                    <p style="font-size:13px;color:#DADADA;margin:0;font-family:${item.label.includes('ID') ? 'monospace' : 'inherit'};">${item.value}</p>
                  </td>
                </tr>
                `).join('')}
                <tr>
                  <td style="padding:10px 0;">
                    <p style="font-size:10px;letter-spacing:0.2em;color:#888888;margin:0 0 4px 0;text-transform:uppercase;">Tattoo Description</p>
                    <p style="font-size:13px;color:#888888;margin:0;line-height:1.6;">${data.description || '—'}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin"
                style="display:inline-block;background-color:#C9A84C;color:#080808;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;padding:12px 28px;text-decoration:none;font-weight:600;">
                View in Admin Panel
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, to, data } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emails: Promise<unknown>[] = []

    if (type === 'booking_confirmation') {
      // Send client confirmation email
      if (to) {
        emails.push(
          resend.emails.send({
            from: `Soulmate Tattoo <${FROM_EMAIL}>`,
            to: [to],
            subject: `Booking Confirmed — ${formatBookingDate(data.bookingDate)}`,
            html: buildClientConfirmationEmail({
              clientName: data.clientName ?? 'Valued Client',
              bookingDate: data.bookingDate,
              paymentIntentId: data.paymentIntentId ?? '',
              bookingId: data.bookingId ?? '',
              description: data.description ?? '',
            }),
          })
        )
      }

      // Send admin notification email
      emails.push(
        resend.emails.send({
          from: `Soulmate Tattoo <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `New Booking — ${formatBookingDate(data.bookingDate)} — ${data.clientName ?? 'Unknown'}`,
          html: buildAdminNotificationEmail({
            clientName: data.clientName ?? 'Unknown',
            clientEmail: to ?? 'Unknown',
            bookingDate: data.bookingDate,
            paymentIntentId: data.paymentIntentId ?? '',
            bookingId: data.bookingId ?? '',
            description: data.description ?? '',
          }),
        })
      )
    } else {
      return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }

    const results = await Promise.allSettled(emails)
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Unknown error')

    if (errors.length > 0) {
      console.error('Email send errors:', errors)
    }

    return NextResponse.json({
      success: true,
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: errors.length,
    })
  } catch (err) {
    console.error('Error in send-email route:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
