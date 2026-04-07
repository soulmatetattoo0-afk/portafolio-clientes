'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#C9A84C]/3 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="font-cormorant text-3xl font-light tracking-[0.2em] text-[#DADADA] hover:text-[#C9A84C] transition-colors duration-300"
          >
            SOULMATE TATTOO
          </Link>
          <div className="w-8 h-px bg-[#C9A84C] mx-auto mt-4" />
        </div>

        {/* Card */}
        <div className="bg-[#161616] border border-[#2A2A2A] p-10">
          <h1 className="font-cormorant text-3xl font-light text-[#DADADA] mb-2">Sign In</h1>
          <p className="font-jost text-sm text-[#DADADA]/40 mb-8">Access your booking dashboard</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block font-jost text-xs tracking-widest text-[#DADADA]/50 uppercase mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-dark"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block font-jost text-xs tracking-widest text-[#DADADA]/50 uppercase mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-dark"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800/50 px-4 py-3">
                <p className="font-jost text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full tracking-widest text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#2A2A2A] text-center">
            <p className="font-jost text-sm text-[#DADADA]/40">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="text-[#C9A84C] hover:text-[#D4B86A] transition-colors duration-200"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/"
            className="font-jost text-xs tracking-widest text-[#DADADA]/30 hover:text-[#DADADA]/60 transition-colors duration-300 uppercase"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
