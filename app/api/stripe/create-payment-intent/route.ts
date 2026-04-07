import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const RESERVATION_AMOUNT = 5000 // €50.00 in cents

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { description, bookingDate } = body

    if (!description || !bookingDate) {
      return NextResponse.json(
        { error: 'Missing required fields: description and bookingDate' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(bookingDate)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Check date is available
    const { data: availability } = await supabase
      .from('availability')
      .select('is_available')
      .eq('date', bookingDate)
      .single()

    if (!availability || !availability.is_available) {
      return NextResponse.json(
        { error: 'Selected date is not available for booking' },
        { status: 409 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: RESERVATION_AMOUNT,
      currency: 'eur',
      metadata: {
        userId: user.id,
        bookingDate,
        userEmail: user.email ?? profile?.email ?? '',
        userName: profile?.full_name ?? '',
      },
      description: `Soulmate Tattoo reservation — ${bookingDate}`,
      receipt_email: user.email ?? profile?.email ?? undefined,
    })

    // Create booking record in Supabase
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        date: bookingDate,
        description: description.trim(),
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      // Cancel the payment intent if booking creation fails
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // Create payment record in Supabase
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: booking.id,
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: RESERVATION_AMOUNT,
        currency: 'eur',
        status: 'pending',
        created_at: new Date().toISOString(),
      })

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      // Non-critical: webhook will handle sync
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err) {
    console.error('Error creating payment intent:', err)
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
