import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AI_CODE = 'YAI-84HZ-2H0M-I3B8'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 })

  const { code } = await req.json()

  if (!code || code.trim() !== AI_CODE) {
    return NextResponse.json({ ok: false, message: 'Invalid code.' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_ai_access')
    .eq('id', user.id)
    .single()

  if (profile?.has_ai_access) {
    return NextResponse.json({ ok: false, message: 'Already redeemed.' })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ has_ai_access: true })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ ok: false, message: 'Failed to redeem. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'AI Character unlocked!' })
}
