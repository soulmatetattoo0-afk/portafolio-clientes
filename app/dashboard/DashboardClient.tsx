'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function DashboardClient() {
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="font-jost text-xs tracking-widest border border-[#2A2A2A] text-[#DADADA]/50 px-4 py-2 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all duration-300 uppercase"
    >
      Logout
    </button>
  )
}
