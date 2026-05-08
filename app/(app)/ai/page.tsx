import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AiArea from '@/components/AiArea'
import type { Profile } from '@/lib/types'

export default async function AiPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ai_access) redirect('/')

  return <AiArea profile={profile as Profile} />
}
