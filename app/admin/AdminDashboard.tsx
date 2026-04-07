'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Booking {
  id: string
  date: string
  status: 'pending' | 'confirmed' | 'cancelled'
  description: string
  created_at: string
  user_id: string
  profiles?: {
    full_name: string
    email: string
  } | null
}

interface Payment {
  id: string
  amount: number
  status: string
  stripe_payment_intent_id: string
  created_at: string
  bookings?: {
    date: string
    profiles?: {
      full_name: string
      email: string
    } | null
  } | null
}

interface AvailabilityRow {
  date: string
  is_available: boolean
}

interface Stats {
  totalRevenue: number
  confirmedBookings: number
  totalClients: number
  availableDays: number
}

interface AdminDashboardProps {
  initialBookings: Booking[]
  initialPayments: Payment[]
  initialAvailability: AvailabilityRow[]
  stats: Stats
}

type Tab = 'overview' | 'calendar' | 'bookings' | 'payments' | 'portfolio'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminDashboard({
  initialBookings,
  initialPayments,
  initialAvailability,
  stats,
}: AdminDashboardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [availability, setAvailability] = useState<AvailabilityRow[]>(initialAvailability)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [portfolioImages, setPortfolioImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [togglingDate, setTogglingDate] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ─── Calendar Logic ────────────────────────────────────────────────────────
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const formatDateString = (d: number) => {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  const getDateStatus = (dateStr: string) => {
    return availability.find((a) => a.date === dateStr)
  }

  const toggleDateAvailability = useCallback(
    async (dateStr: string) => {
      setTogglingDate(dateStr)
      const current = getDateStatus(dateStr)
      const newAvailability = !current?.is_available

      try {
        const res = await fetch('/api/admin/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, is_available: newAvailability }),
        })

        if (!res.ok) throw new Error('Failed to update availability')

        setAvailability((prev) => {
          const existing = prev.find((a) => a.date === dateStr)
          if (existing) {
            return prev.map((a) => (a.date === dateStr ? { ...a, is_available: newAvailability } : a))
          }
          return [...prev, { date: dateStr, is_available: newAvailability }]
        })
      } catch (error) {
        console.error('Error toggling date:', error)
        alert('Failed to update availability. Please try again.')
      } finally {
        setTogglingDate(null)
      }
    },
    [availability]
  )

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

      if (error) throw error

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      )
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: 'cancelled' })
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      alert('Failed to cancel booking.')
    }
  }

  const handleCloudinaryUpload = () => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      alert('Cloudinary not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your environment variables.')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloudinaryWidget = (window as any).cloudinary?.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        folder: 'soulmate-tattoo-portfolio',
        sources: ['local', 'url', 'camera'],
        multiple: true,
        maxFileSize: 10000000,
        resourceType: 'image',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error: any, result: any) => {
        if (!error && result && result.event === 'success') {
          setPortfolioImages((prev) => [...prev, result.info.secure_url])
        }
      }
    )

    if (cloudinaryWidget) {
      cloudinaryWidget.open()
    } else {
      alert('Cloudinary widget not loaded. Add the Cloudinary script to your page.')
    }
  }

  const handleDeletePortfolioImage = (url: string) => {
    if (!confirm('Delete this image from the portfolio?')) return
    setPortfolioImages((prev) => prev.filter((img) => img !== url))
  }

  const statusConfig = {
    pending: { label: 'Pending', classes: 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400' },
    confirmed: { label: 'Confirmed', classes: 'bg-green-900/30 border-green-700/50 text-green-400' },
    cancelled: { label: 'Cancelled', classes: 'bg-red-900/30 border-red-700/50 text-red-400' },
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'payments', label: 'Payments' },
    { id: 'portfolio', label: 'Portfolio' },
  ]

  return (
    <div className="min-h-screen bg-[#080808] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0C0C0C] border-r border-[#2A2A2A] flex flex-col fixed top-0 left-0 bottom-0 z-30">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[#2A2A2A]">
          <p className="font-cormorant text-lg font-light tracking-[0.2em] text-[#DADADA]">SOULMATE</p>
          <p className="font-jost text-xs tracking-widest text-[#C9A84C]/70 uppercase">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-6 py-3.5 font-jost text-sm tracking-widest uppercase transition-all duration-200 ${
                activeTab === tab.id
                  ? 'text-[#C9A84C] bg-[#C9A84C]/5 border-r-2 border-[#C9A84C]'
                  : 'text-[#DADADA]/50 hover:text-[#DADADA] hover:bg-[#161616]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-6 py-6 border-t border-[#2A2A2A]">
          <button
            onClick={handleLogout}
            className="w-full font-jost text-xs tracking-widest text-[#DADADA]/40 hover:text-[#C9A84C] uppercase transition-colors duration-200 text-left"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64 flex-1 p-8">

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === 'overview' && (
          <div>
            <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Overview</h1>
            <div className="w-8 h-px bg-[#C9A84C] mb-8" />

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                {
                  label: 'Total Revenue',
                  value: `€${(stats.totalRevenue / 100).toFixed(2)}`,
                  sub: 'From reservations',
                },
                {
                  label: 'Confirmed Bookings',
                  value: stats.confirmedBookings.toString(),
                  sub: 'Active sessions',
                },
                {
                  label: 'Total Clients',
                  value: stats.totalClients.toString(),
                  sub: 'Unique clients',
                },
                {
                  label: 'Available Days',
                  value: stats.availableDays.toString(),
                  sub: 'Upcoming slots',
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#161616] border border-[#2A2A2A] p-6">
                  <p className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase mb-3">{stat.label}</p>
                  <p className="font-cormorant text-4xl text-[#C9A84C] font-light mb-1">{stat.value}</p>
                  <p className="font-jost text-xs text-[#DADADA]/30">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Recent bookings preview */}
            <div className="bg-[#161616] border border-[#2A2A2A] p-6">
              <h2 className="font-cormorant text-xl text-[#DADADA] font-light mb-4">Recent Bookings</h2>
              <div className="space-y-3">
                {bookings.slice(0, 5).map((booking) => {
                  const sc = statusConfig[booking.status] ?? statusConfig.pending
                  return (
                    <div key={booking.id} className="flex items-center justify-between py-3 border-b border-[#2A2A2A] last:border-0">
                      <div>
                        <p className="font-jost text-sm text-[#DADADA]">{formatDate(booking.date)}</p>
                        <p className="font-jost text-xs text-[#DADADA]/40">{booking.profiles?.full_name ?? 'Unknown Client'}</p>
                      </div>
                      <span className={`font-jost text-xs tracking-widest px-2 py-1 border uppercase ${sc.classes}`}>
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
                {bookings.length === 0 && (
                  <p className="font-jost text-sm text-[#DADADA]/30 text-center py-4">No bookings yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── CALENDAR TAB ─── */}
        {activeTab === 'calendar' && (
          <div>
            <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Availability Calendar</h1>
            <div className="w-8 h-px bg-[#C9A84C] mb-2" />
            <p className="font-jost text-sm text-[#DADADA]/40 mb-8">Click a day to toggle its availability.</p>

            <div className="bg-[#161616] border border-[#2A2A2A] p-6 max-w-2xl">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                  className="p-2 text-[#C9A84C] hover:text-[#D4B86A] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <h2 className="font-cormorant text-2xl font-light tracking-widest text-[#DADADA]">
                  {MONTHS[month]} {year}
                </h2>
                <button
                  onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                  className="p-2 text-[#C9A84C] hover:text-[#D4B86A] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="text-center font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }, (_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const dateStr = formatDateString(d)
                  const avail = getDateStatus(dateStr)
                  const isAvailable = avail?.is_available
                  const isToggling = togglingDate === dateStr
                  const isPast = new Date(dateStr) < new Date(new Date().setHours(0,0,0,0))

                  return (
                    <div key={d} className="p-0.5">
                      <button
                        onClick={() => !isPast && toggleDateAvailability(dateStr)}
                        disabled={isPast || isToggling}
                        className={`relative w-full aspect-square flex items-center justify-center text-sm font-jost transition-all duration-200 ${
                          isPast
                            ? 'text-[#DADADA]/20 cursor-not-allowed'
                            : isAvailable
                            ? 'bg-[#C9A84C]/10 border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/20 cursor-pointer'
                            : 'border border-[#2A2A2A] text-[#DADADA]/40 hover:border-[#3A3A3A] cursor-pointer'
                        }`}
                        title={`${dateStr} — ${isAvailable ? 'Available (click to make unavailable)' : 'Unavailable (click to make available)'}`}
                      >
                        {isToggling ? (
                          <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          d
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 pt-4 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-[#C9A84C] bg-[#C9A84C]/10" />
                  <span className="font-jost text-xs text-[#DADADA]/50">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-[#2A2A2A]" />
                  <span className="font-jost text-xs text-[#DADADA]/50">Unavailable</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── BOOKINGS TAB ─── */}
        {activeTab === 'bookings' && (
          <div>
            <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Bookings</h1>
            <div className="w-8 h-px bg-[#C9A84C] mb-8" />

            <div className="bg-[#161616] border border-[#2A2A2A] overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    {['Date', 'Client', 'Description', 'Status', 'Actions'].map((col) => (
                      <th key={col} className="text-left px-6 py-4 font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const sc = statusConfig[booking.status] ?? statusConfig.pending
                    return (
                      <tr key={booking.id} className="border-b border-[#2A2A2A] hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-jost text-sm text-[#DADADA] whitespace-nowrap">{formatDate(booking.date)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-jost text-sm text-[#DADADA]">{booking.profiles?.full_name ?? '—'}</p>
                          <p className="font-jost text-xs text-[#DADADA]/40">{booking.profiles?.email ?? '—'}</p>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <span className="font-jost text-sm text-[#DADADA]/60 line-clamp-2">
                            {booking.description.slice(0, 80)}...
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-jost text-xs tracking-widest px-2 py-1 border uppercase whitespace-nowrap ${sc.classes}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="font-jost text-xs tracking-widest text-[#C9A84C] hover:text-[#D4B86A] uppercase transition-colors"
                            >
                              View
                            </button>
                            {booking.status !== 'cancelled' && (
                              <>
                                <span className="text-[#2A2A2A]">|</span>
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="font-jost text-xs tracking-widest text-red-400/70 hover:text-red-400 uppercase transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="font-jost text-sm text-[#DADADA]/30">No bookings yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── PAYMENTS TAB ─── */}
        {activeTab === 'payments' && (
          <div>
            <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Payments</h1>
            <div className="w-8 h-px bg-[#C9A84C] mb-8" />

            <div className="bg-[#161616] border border-[#2A2A2A] overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    {['Date', 'Client', 'Amount', 'Stripe ID', 'Status'].map((col) => (
                      <th key={col} className="text-left px-6 py-4 font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {initialPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#2A2A2A] hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-jost text-sm text-[#DADADA] whitespace-nowrap">
                          {formatDateTime(payment.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-jost text-sm text-[#DADADA]">
                          {payment.bookings?.profiles?.full_name ?? '—'}
                        </p>
                        <p className="font-jost text-xs text-[#DADADA]/40">
                          {payment.bookings?.profiles?.email ?? '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-cormorant text-xl text-[#C9A84C]">
                          €{(payment.amount / 100).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-[#DADADA]/40">
                          {payment.stripe_payment_intent_id.slice(0, 24)}...
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-jost text-xs tracking-widest px-2 py-1 border uppercase ${
                            payment.status === 'paid'
                              ? 'bg-green-900/30 border-green-700/50 text-green-400'
                              : 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {initialPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="font-jost text-sm text-[#DADADA]/30">No payments yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── PORTFOLIO TAB ─── */}
        {activeTab === 'portfolio' && (
          <div>
            <h1 className="font-cormorant text-4xl font-light text-[#DADADA] mb-2">Portfolio</h1>
            <div className="w-8 h-px bg-[#C9A84C] mb-2" />
            <p className="font-jost text-sm text-[#DADADA]/40 mb-8">
              Upload portfolio images via Cloudinary. Images will appear on the public gallery.
            </p>

            <button
              onClick={handleCloudinaryUpload}
              disabled={uploadingImage}
              className="btn-gold tracking-widest text-sm uppercase mb-8 flex items-center gap-3 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {uploadingImage ? 'Uploading...' : 'Upload Images'}
            </button>

            {portfolioImages.length === 0 ? (
              <div className="bg-[#161616] border border-[#2A2A2A] border-dashed p-16 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="1" className="mx-auto mb-4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="font-jost text-sm text-[#DADADA]/30">No portfolio images yet</p>
                <p className="font-jost text-xs text-[#DADADA]/20 mt-1">Click &quot;Upload Images&quot; to add photos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {portfolioImages.map((url, index) => (
                  <div key={index} className="group relative aspect-square bg-[#161616] border border-[#2A2A2A] overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${url})` }}
                    />
                    <div className="absolute inset-0 bg-[#080808]/0 group-hover:bg-[#080808]/60 transition-all duration-300 flex items-center justify-center">
                      <button
                        onClick={() => handleDeletePortfolioImage(url)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-red-900/80 border border-red-700 p-2"
                        aria-label="Delete image"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Booking Detail Modal ─── */}
      {selectedBooking && (
        <div
          className="fixed inset-0 bg-[#080808]/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="bg-[#161616] border border-[#2A2A2A] p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <h2 className="font-cormorant text-2xl font-light text-[#DADADA]">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-[#DADADA]/40 hover:text-[#DADADA] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Date', value: formatDate(selectedBooking.date) },
                { label: 'Client', value: selectedBooking.profiles?.full_name ?? '—' },
                { label: 'Email', value: selectedBooking.profiles?.email ?? '—' },
                { label: 'Booked on', value: formatDateTime(selectedBooking.created_at) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase mb-1">{item.label}</p>
                  <p className="font-jost text-sm text-[#DADADA]">{item.value}</p>
                </div>
              ))}

              <div>
                <p className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase mb-1">Status</p>
                <span className={`font-jost text-xs tracking-widest px-2 py-1 border uppercase ${(statusConfig[selectedBooking.status] ?? statusConfig.pending).classes}`}>
                  {(statusConfig[selectedBooking.status] ?? statusConfig.pending).label}
                </span>
              </div>

              <div>
                <p className="font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase mb-2">Description</p>
                <div className="bg-[#0d0d0d] border border-[#2A2A2A] p-4">
                  <p className="font-jost text-sm text-[#DADADA]/70 leading-relaxed">{selectedBooking.description}</p>
                </div>
              </div>

              {selectedBooking.status !== 'cancelled' && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  className="w-full border border-red-800/50 text-red-400 font-jost text-xs tracking-widest uppercase py-3 hover:bg-red-900/20 transition-colors duration-200 mt-4"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
