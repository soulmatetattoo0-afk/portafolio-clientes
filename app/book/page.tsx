'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Calendar from '@/components/Calendar'
import { createBrowserClient } from '@supabase/ssr'

interface AvailabilityRow {
  date: string
  is_available: boolean
}

export default function BookPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [bookedDates, setBookedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const res = await fetch('/api/availability')
        if (!res.ok) throw new Error('Failed to fetch availability')
        const data: AvailabilityRow[] = await res.json()
        const available = data.filter((row) => row.is_available).map((row) => row.date)
        const booked = data.filter((row) => !row.is_available).map((row) => row.date)
        setAvailableDates(available)
        setBookedDates(booked)
      } catch (error) {
        console.error('Error fetching availability:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAvailability()
  }, [])

  const handleContinue = () => {
    if (!selectedDate) return
    sessionStorage.setItem('bookingDate', selectedDate)
    router.push('/book/checkout')
  }

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Fixed Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/95 backdrop-blur-sm border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#DADADA]/60 hover:text-[#C9A84C] transition-colors duration-300"
            aria-label="Back to home"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            <span className="font-jost text-sm tracking-widest uppercase">Back</span>
          </Link>

          <Link
            href="/"
            className="font-cormorant text-xl font-light tracking-[0.2em] text-[#DADADA] hover:text-[#C9A84C] transition-colors duration-300"
          >
            SOULMATE TATTOO
          </Link>

          <div className="w-20" />
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-16 px-6">
        {/* Hero Header */}
        <div className="text-center mb-16 pt-10">
          <p className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase mb-4">Step 1 of 3</p>
          <h1 className="font-cormorant text-5xl md:text-6xl font-light text-[#DADADA] tracking-wide mb-4">
            Book a Session
          </h1>
          <div className="w-12 h-px bg-[#C9A84C] mx-auto mb-8" />

          {/* Info pills */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { text: '€50 Reservation' },
              { text: '12PM – 7PM' },
              { text: 'Private Studio' },
              { text: 'Artist: Camo' },
            ].map((pill) => (
              <div
                key={pill.text}
                className="bg-[#161616] border border-[#2A2A2A] px-4 py-2"
              >
                <span className="font-jost text-xs tracking-widest text-[#DADADA]/60 uppercase">{pill.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="max-w-[720px] mx-auto">
          {loading ? (
            <div className="bg-[#161616] border border-[#2A2A2A] p-16 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              <p className="font-jost text-sm text-[#DADADA]/40 tracking-widest uppercase">Loading availability...</p>
            </div>
          ) : (
            <Calendar
              availableDates={availableDates}
              bookedDates={bookedDates}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          )}

          {/* Selected date panel */}
          {selectedDate && (
            <div className="mt-4 bg-[#161616] border border-[#C9A84C]/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
              <div>
                <p className="font-jost text-xs tracking-widest text-[#C9A84C]/70 uppercase mb-1">Selected Date</p>
                <p className="font-cormorant text-xl text-[#DADADA] font-light">{formatDisplayDate(selectedDate)}</p>
              </div>

              {authLoading ? (
                <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              ) : user ? (
                <button
                  onClick={handleContinue}
                  className="btn-gold tracking-widest text-sm uppercase min-w-[200px] text-center whitespace-nowrap"
                >
                  Continue to Checkout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="btn-gold inline-block tracking-widest text-sm uppercase min-w-[200px] text-center whitespace-nowrap"
                >
                  Login to Book
                </Link>
              )}
            </div>
          )}

          {/* Helper text when no date selected */}
          {!selectedDate && !loading && (
            <div className="mt-4 text-center">
              <p className="font-jost text-xs text-[#DADADA]/30 tracking-wide">
                Select an available date (shown with gold border) to continue
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
