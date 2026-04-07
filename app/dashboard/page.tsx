import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import DashboardClient from './DashboardClient'

interface Booking {
  id: string
  date: string
  status: 'pending' | 'confirmed' | 'cancelled'
  description: string
  created_at: string
  payments?: {
    stripe_payment_intent_id: string
    amount: number
    status: string
  }[]
}

async function getBookings(userId: string): Promise<Booking[]> {
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

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      date,
      status,
      description,
      created_at,
      payments (
        stripe_payment_intent_id,
        amount,
        status
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching bookings:', error)
    return []
  }

  return (data as Booking[]) ?? []
}

export default async function DashboardPage() {
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

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const bookings = await getBookings(user.id)

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#080808]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="font-cormorant text-xl font-light tracking-[0.2em] text-[#DADADA] hover:text-[#C9A84C] transition-colors duration-300"
            >
              SOULMATE TATTOO
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-jost text-xs text-[#DADADA]/40 tracking-wide hidden sm:block">
              {user.email}
            </span>
            <DashboardClient />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="mb-10">
          <p className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase mb-2">Client Portal</p>
          <h1 className="font-cormorant text-4xl md:text-5xl font-light text-[#DADADA]">My Bookings</h1>
          <div className="w-10 h-px bg-[#C9A84C] mt-4" />
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="bg-[#161616] border border-[#2A2A2A] p-16 text-center">
            <div className="w-16 h-16 border border-[#2A2A2A] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h2 className="font-cormorant text-2xl text-[#DADADA]/60 font-light mb-3">No bookings yet</h2>
            <p className="font-jost text-sm text-[#DADADA]/30 mb-8 max-w-md mx-auto leading-relaxed">
              You haven&apos;t made any bookings yet. Reserve your session with Camo to begin your tattoo journey.
            </p>
            <Link href="/book" className="btn-gold inline-block tracking-widest text-sm uppercase">
              Book a Session
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}

            <div className="pt-6 text-center">
              <Link
                href="/book"
                className="font-jost text-sm tracking-widest text-[#C9A84C] border-b border-[#C9A84C]/30 pb-1 hover:border-[#C9A84C] transition-colors duration-300 uppercase"
              >
                Book Another Session
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCreatedAt = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const statusConfig = {
    pending: { label: 'Pending', classes: 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400' },
    confirmed: { label: 'Confirmed', classes: 'bg-green-900/30 border-green-700/50 text-green-400' },
    cancelled: { label: 'Cancelled', classes: 'bg-red-900/30 border-red-700/50 text-red-400' },
  }

  const status = statusConfig[booking.status] ?? statusConfig.pending
  const payment = booking.payments?.[0]

  return (
    <div className="bg-[#161616] border border-[#2A2A2A] p-6 hover:border-[#3A3A3A] transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-cormorant text-xl text-[#DADADA] font-light">
              {formatDate(booking.date)}
            </h3>
            <span className={`font-jost text-xs tracking-widest px-2.5 py-1 border uppercase ${status.classes}`}>
              {status.label}
            </span>
          </div>

          <p className="font-jost text-sm text-[#DADADA]/50 leading-relaxed mb-4 max-w-xl">
            {booking.description.length > 150
              ? booking.description.slice(0, 150) + '...'
              : booking.description}
          </p>

          <div className="flex flex-wrap gap-4">
            <div>
              <span className="font-jost text-xs tracking-widest text-[#DADADA]/30 uppercase">Booked on</span>
              <p className="font-jost text-xs text-[#DADADA]/50 mt-0.5">{formatCreatedAt(booking.created_at)}</p>
            </div>
            {payment && (
              <>
                <div className="w-px h-8 bg-[#2A2A2A]" />
                <div>
                  <span className="font-jost text-xs tracking-widest text-[#DADADA]/30 uppercase">Payment</span>
                  <p className="font-jost text-xs text-[#C9A84C] mt-0.5">€{(payment.amount / 100).toFixed(2)} paid</p>
                </div>
                <div className="w-px h-8 bg-[#2A2A2A]" />
                <div>
                  <span className="font-jost text-xs tracking-widest text-[#DADADA]/30 uppercase">Ref</span>
                  <p className="font-jost text-xs text-[#DADADA]/40 mt-0.5 font-mono">
                    {payment.stripe_payment_intent_id.slice(0, 20)}...
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
