import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch initial data
  const [bookingsResult, paymentsResult, availabilityResult] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id,
        date,
        status,
        description,
        created_at,
        user_id,
        profiles (
          full_name,
          email
        )
      `)
      .order('date', { ascending: true }),
    supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        stripe_payment_intent_id,
        created_at,
        bookings (
          date,
          profiles (
            full_name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('availability')
      .select('date, is_available')
      .order('date', { ascending: true }),
  ])

  const bookings = bookingsResult.data ?? []
  const payments = paymentsResult.data ?? []
  const availability = availabilityResult.data ?? []

  // Calculate stats
  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length
  const totalClients = new Set(bookings.map((b) => b.user_id)).size
  const availableDays = availability.filter((a) => a.is_available).length

  return (
    <AdminDashboard
      initialBookings={bookings}
      initialPayments={payments}
      initialAvailability={availability}
      stats={{
        totalRevenue,
        confirmedBookings,
        totalClients,
        availableDays,
      }}
    />
  )
}
