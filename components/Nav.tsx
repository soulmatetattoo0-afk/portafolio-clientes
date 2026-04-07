'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#080808]/95 backdrop-blur-sm border-b border-[#2A2A2A]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-cormorant text-xl font-light tracking-[0.2em] text-[#DADADA] hover:text-[#C9A84C] transition-colors duration-300">
          SOULMATE TATTOO
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-10">
          <Link href="/#gallery" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase">
            Gallery
          </Link>
          <Link href="/#about" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase">
            About
          </Link>
          <Link href="/book" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase">
            Book
          </Link>
        </div>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="font-jost text-sm tracking-widest border border-[#2A2A2A] text-[#DADADA]/60 px-4 py-2 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all duration-300 uppercase"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="font-jost text-sm tracking-widest border border-[#C9A84C] text-[#C9A84C] px-5 py-2 hover:bg-[#C9A84C] hover:text-[#080808] transition-all duration-300 uppercase"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-px bg-[#DADADA] transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-px bg-[#DADADA] transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-px bg-[#DADADA] transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${
          menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        } bg-[#080808]/98 border-t border-[#2A2A2A]`}
      >
        <div className="px-6 py-6 flex flex-col gap-6">
          <Link href="/#gallery" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase" onClick={() => setMenuOpen(false)}>
            Gallery
          </Link>
          <Link href="/#about" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase" onClick={() => setMenuOpen(false)}>
            About
          </Link>
          <Link href="/book" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase" onClick={() => setMenuOpen(false)}>
            Book
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="font-jost text-sm tracking-widest text-[#DADADA]/70 hover:text-[#C9A84C] transition-colors duration-300 uppercase" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="font-jost text-sm tracking-widest text-left text-[#DADADA]/60 hover:text-[#C9A84C] transition-colors duration-300 uppercase">
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="font-jost text-sm tracking-widest text-[#C9A84C] uppercase" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
