'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { createBrowserClient } from '@supabase/ssr'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ─── Payment Form Component ────────────────────────────────────────────────
interface PaymentFormProps {
  bookingId: string
  onSuccess: (paymentIntentId: string) => void
}

function PaymentForm({ bookingId, onSuccess }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Payment failed. Please try again.')
      setLoading(false)
      return
    }

    const returnUrl = `${window.location.origin}/book/checkout?step=3&bookingId=${bookingId}`

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.')
      setLoading(false)
      return
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    } else {
      setError('Payment could not be confirmed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#1a1a1a] border border-[#2A2A2A] p-6 rounded-none">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: { name: 'auto' } },
          }}
        />
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 px-4 py-3">
          <p className="font-jost text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-gold w-full tracking-widest text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          'Pay €50 Reservation'
        )}
      </button>

      <p className="font-jost text-xs text-[#DADADA]/30 text-center tracking-wide">
        Secured by Stripe. Your card details are encrypted and never stored.
      </p>
    </form>
  )
}

// ─── Main Checkout Page ────────────────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [description, setDescription] = useState('')
  const [bookingDate, setBookingDate] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Get booking date from sessionStorage
    const date = sessionStorage.getItem('bookingDate')
    if (!date) {
      router.push('/book')
      return
    }
    setBookingDate(date)

    // Check auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
      }
    })

    // Check for return from Stripe redirect
    const params = new URLSearchParams(window.location.search)
    const stepParam = params.get('step')
    const bookingIdParam = params.get('bookingId')
    if (stepParam === '3' && bookingIdParam) {
      setBookingId(bookingIdParam)
      setStep(3)
    }
  }, [])

  const handleDescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, bookingDate }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create payment intent')
      }

      const data = await res.json()
      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = useCallback((piId: string) => {
    setPaymentIntentId(piId)
    setStep(3)
    sessionStorage.removeItem('bookingDate')
  }, [])

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'night' as const,
          variables: {
            colorPrimary: '#C9A84C',
            colorBackground: '#161616',
            colorText: '#DADADA',
            colorDanger: '#EF4444',
            fontFamily: 'Jost, system-ui, sans-serif',
            borderRadius: '0px',
            colorIcon: '#C9A84C',
          },
          rules: {
            '.Input': {
              border: '1px solid #2A2A2A',
              backgroundColor: '#161616',
              color: '#DADADA',
            },
            '.Input:focus': {
              border: '1px solid #C9A84C',
              boxShadow: 'none',
            },
            '.Label': {
              color: '#888888',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            },
          },
        },
      }
    : undefined

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Fixed Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/95 backdrop-blur-sm border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => step > 1 && step < 3 ? setStep(step - 1) : router.push('/book')}
            className="flex items-center gap-2 text-[#DADADA]/60 hover:text-[#C9A84C] transition-colors duration-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5M12 5l-7 7 7-7" />
            </svg>
            <span className="font-jost text-sm tracking-widest uppercase">Back</span>
          </button>

          <Link
            href="/"
            className="font-cormorant text-xl font-light tracking-[0.2em] text-[#DADADA] hover:text-[#C9A84C] transition-colors duration-300"
          >
            SOULMATE TATTOO
          </Link>

          <div className="w-20" />
        </div>
      </div>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto">
          {/* Progress Indicator */}
          {step < 3 && (
            <div className="mb-12 pt-10">
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 flex items-center justify-center font-jost text-xs font-semibold transition-all duration-300 ${
                        s <= step
                          ? 'bg-[#C9A84C] text-[#080808]'
                          : 'border border-[#2A2A2A] text-[#DADADA]/30'
                      }`}
                    >
                      {s < step ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        s
                      )}
                    </div>
                    {s < 3 && (
                      <div className={`w-12 h-px transition-all duration-300 ${s < step ? 'bg-[#C9A84C]' : 'bg-[#2A2A2A]'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center font-jost text-xs tracking-[0.4em] text-[#DADADA]/30 uppercase">
                Step {step} of 3 — {step === 1 ? 'Details' : step === 2 ? 'Payment' : 'Confirmation'}
              </p>
            </div>
          )}

          {/* Booking Date Display */}
          {bookingDate && step < 3 && (
            <div className="bg-[#161616] border border-[#2A2A2A] px-6 py-4 mb-8 flex items-center gap-4">
              <div className="w-8 h-8 bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase mb-0.5">Session Date</p>
                <p className="font-cormorant text-lg text-[#DADADA] font-light">{formatDisplayDate(bookingDate)}</p>
              </div>
            </div>
          )}

          {/* ─── STEP 1: Description ─── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Tell us about your tattoo</h1>
              <div className="w-8 h-px bg-[#C9A84C] mb-8" />
              <p className="font-jost text-sm text-[#DADADA]/50 mb-8 leading-relaxed">
                Describe your tattoo idea — placement, size, style references, and any other details
                that will help Camo understand your vision.
              </p>

              <form onSubmit={handleDescriptionSubmit} className="space-y-6">
                <div>
                  <label htmlFor="description" className="block font-jost text-xs tracking-widest text-[#DADADA]/50 uppercase mb-3">
                    Tattoo Description *
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={8}
                    placeholder="E.g. A realistic portrait of my dog on my forearm, approximately 15cm tall, black and grey style..."
                    className="input-dark resize-none"
                    required
                    minLength={20}
                  />
                  <p className="font-jost text-xs text-[#DADADA]/30 mt-2">Minimum 20 characters</p>
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-800/50 px-4 py-3">
                    <p className="font-jost text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || description.trim().length < 20}
                  className="btn-gold w-full tracking-widest text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    'Continue to Payment'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ─── STEP 2: Payment ─── */}
          {step === 2 && clientSecret && (
            <div className="animate-fade-in">
              <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Secure your date</h1>
              <div className="w-8 h-px bg-[#C9A84C] mb-8" />

              <div className="bg-[#161616] border border-[#2A2A2A] p-5 mb-8">
                <div className="flex items-center justify-between">
                  <span className="font-jost text-sm text-[#DADADA]/60">Reservation fee</span>
                  <span className="font-cormorant text-2xl text-[#C9A84C]">€50.00</span>
                </div>
                <p className="font-jost text-xs text-[#DADADA]/30 mt-2 leading-relaxed">
                  This fee secures your date and is deducted from the total session cost.
                </p>
              </div>

              {stripeOptions && (
                <Elements stripe={stripePromise} options={stripeOptions}>
                  <PaymentForm bookingId={bookingId!} onSuccess={handlePaymentSuccess} />
                </Elements>
              )}
            </div>
          )}

          {/* ─── STEP 3: Confirmation ─── */}
          {step === 3 && (
            <div className="animate-fade-in text-center pt-10">
              {/* Success icon */}
              <div className="w-20 h-20 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-full flex items-center justify-center mx-auto mb-8">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-4">Booking Confirmed</h1>
              <div className="w-12 h-px bg-[#C9A84C] mx-auto mb-8" />

              <p className="font-jost text-sm text-[#DADADA]/50 leading-relaxed mb-10">
                Your reservation has been received and a confirmation email is on its way to you.
                Camo will be in touch to discuss the details of your session.
              </p>

              {/* Booking summary */}
              <div className="bg-[#161616] border border-[#2A2A2A] p-8 mb-8 text-left">
                <h2 className="font-cormorant text-xl text-[#DADADA] font-light mb-6">Booking Summary</h2>
                <div className="space-y-4">
                  {bookingDate && (
                    <div className="flex items-start justify-between">
                      <span className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase">Date</span>
                      <span className="font-jost text-sm text-[#DADADA]">{formatDisplayDate(bookingDate)}</span>
                    </div>
                  )}
                  <div className="h-px bg-[#2A2A2A]" />
                  <div className="flex items-start justify-between">
                    <span className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase">Artist</span>
                    <span className="font-jost text-sm text-[#DADADA]">Camo</span>
                  </div>
                  <div className="h-px bg-[#2A2A2A]" />
                  <div className="flex items-start justify-between">
                    <span className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase">Reservation</span>
                    <span className="font-jost text-sm text-[#C9A84C]">€50.00 paid</span>
                  </div>
                  {(paymentIntentId ?? (new URLSearchParams(window.location.search).get('payment_intent'))) && (
                    <>
                      <div className="h-px bg-[#2A2A2A]" />
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase flex-shrink-0">Reference</span>
                        <span className="font-jost text-xs text-[#DADADA]/40 text-right break-all">
                          {paymentIntentId ?? new URLSearchParams(window.location.search).get('payment_intent')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="btn-gold inline-block tracking-widest text-sm uppercase text-center"
                >
                  View My Bookings
                </Link>
                <Link
                  href="/"
                  className="btn-outline-gold inline-block tracking-widest text-sm uppercase text-center"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
