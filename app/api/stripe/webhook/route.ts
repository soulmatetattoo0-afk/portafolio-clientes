import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Required: disable body parsing to get raw body for signature verification
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Use service role for webhook operations (no user session)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {},
      },
    }
  )

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const paymentIntentId = paymentIntent.id
        const { userId, bookingDate, userEmail, userName } = paymentIntent.metadata

        console.log(`Payment succeeded: ${paymentIntentId}`)

        // Update payment record to 'paid'
        const { error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        if (paymentUpdateError) {
          console.error('Error updating payment status:', paymentUpdateError)
        }

        // Update booking status to 'confirmed'
        const { data: booking, error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .select()
          .single()

        if (bookingUpdateError) {
          console.error('Error updating booking status:', bookingUpdateError)
        }

        // Mark date as no longer available
        if (bookingDate) {
          const { error: availabilityError } = await supabase
            .from('availability')
            .upsert(
              { date: bookingDate, is_available: false, updated_at: new Date().toISOString() },
              { onConflict: 'date' }
            )
          if (availabilityError) {
            console.error('Error updating availability:', availabilityError)
          }
        }

        // Send confirmation email
        try {
          const emailRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'booking_confirmation',
                to: userEmail,
                data: {
                  clientName: userName || 'Valued Client',
                  bookingDate: bookingDate,
                  paymentIntentId,
                  bookingId: booking?.id,
                  description: booking?.description ?? '',
                },
              }),
            }
          )
          if (!emailRes.ok) {
            console.error('Failed to send confirmation email:', await emailRes.text())
          }
        } catch (emailErr) {
          console.error('Error calling send-email API:', emailErr)
        }

        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`Payment failed: ${paymentIntent.id}`)

        await supabase
          .from('payments')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`Payment cancelled: ${paymentIntent.id}`)

        await supabase
          .from('payments')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Error processing webhook event:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
