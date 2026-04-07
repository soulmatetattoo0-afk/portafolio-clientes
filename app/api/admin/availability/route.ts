import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()

    // Use service role for admin operations
    const supabaseAdmin = createServerClient(
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

    // Verify user auth
    const { data: { user } } = await supabaseAdmin.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { date, is_available } = body

    if (!date || typeof is_available !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. Provide date (string) and is_available (boolean).' },
        { status: 400 }
      )
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    // Upsert availability
    const { data, error } = await supabaseAdmin
      .from('availability')
      .upsert(
        { date, is_available, updated_at: new Date().toISOString() },
        { onConflict: 'date' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error upserting availability:', error)
      return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Unexpected error in admin availability route:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
