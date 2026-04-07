'use client'

import { useState } from 'react'

interface CalendarProps {
  availableDates: string[]
  bookedDates: string[]
  selectedDate: string | null
  onDateSelect: (date: string) => void
  currentMonth?: Date
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Calendar({
  availableDates,
  bookedDates,
  selectedDate,
  onDateSelect,
}: CalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const formatDateString = (d: number) => {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  const isPast = (d: number) => {
    const date = new Date(year, month, d)
    return date < today
  }

  const isAvailable = (dateStr: string) => availableDates.includes(dateStr)
  const isBooked = (dateStr: string) => bookedDates.includes(dateStr)
  const isSelected = (dateStr: string) => dateStr === selectedDate
  const isToday = (d: number) => {
    const dateStr = formatDateString(d)
    const todayStr = today.toISOString().split('T')[0]
    return dateStr === todayStr
  }

  const canNavigatePrev = () => {
    const prevMonthDate = new Date(year, month - 1, 1)
    const todayFirstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return prevMonthDate >= todayFirstDay
  }

  const getDayClasses = (d: number) => {
    const dateStr = formatDateString(d)
    const past = isPast(d)
    const available = isAvailable(dateStr)
    const booked = isBooked(dateStr)
    const selected = isSelected(dateStr)
    const todayDay = isToday(d)

    let classes =
      'relative w-full aspect-square flex items-center justify-center text-sm font-jost transition-all duration-200 '

    if (selected) {
      classes += 'bg-[#C9A84C] text-[#080808] font-semibold cursor-pointer'
    } else if (booked) {
      classes += 'border border-red-800/50 text-red-400/50 cursor-not-allowed opacity-50'
    } else if (past) {
      classes += 'text-[#DADADA]/20 cursor-not-allowed'
    } else if (available) {
      classes +=
        'border border-[#C9A84C] text-[#C9A84C] cursor-pointer hover:bg-[#C9A84C] hover:text-[#080808] font-medium'
    } else {
      classes += 'text-[#DADADA]/40 cursor-not-allowed'
    }

    if (todayDay && !selected) {
      classes += ' ring-1 ring-[#DADADA]/30'
    }

    return classes
  }

  const handleDayClick = (d: number) => {
    const dateStr = formatDateString(d)
    if (!isPast(d) && isAvailable(dateStr) && !isBooked(dateStr)) {
      onDateSelect(dateStr)
    }
  }

  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="bg-[#161616] border border-[#2A2A2A] p-6 md:p-8">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={prevMonth}
          disabled={!canNavigatePrev()}
          className={`p-2 transition-colors duration-200 ${
            canNavigatePrev()
              ? 'text-[#C9A84C] hover:text-[#D4B86A]'
              : 'text-[#DADADA]/20 cursor-not-allowed'
          }`}
          aria-label="Previous month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h2 className="font-cormorant text-2xl font-light tracking-widest text-[#DADADA]">
          {MONTHS[month]} {year}
        </h2>

        <button
          onClick={nextMonth}
          className="p-2 text-[#C9A84C] hover:text-[#D4B86A] transition-colors duration-200"
          aria-label="Next month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-center font-jost text-xs tracking-widest text-[#DADADA]/40 uppercase py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <div key={d} className="p-0.5">
            <button
              onClick={() => handleDayClick(d)}
              className={getDayClasses(d)}
              title={formatDateString(d)}
            >
              {d}
            </button>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-[#C9A84C]" />
          <span className="font-jost text-xs text-[#DADADA]/50 tracking-wide">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#C9A84C]" />
          <span className="font-jost text-xs text-[#DADADA]/50 tracking-wide">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-red-800/50 opacity-50" />
          <span className="font-jost text-xs text-[#DADADA]/50 tracking-wide">Booked</span>
        </div>
      </div>
    </div>
  )
}
