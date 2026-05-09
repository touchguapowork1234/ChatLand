import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DMArea from '@/components/DMArea'
import type { Profile } from '@/lib/types'

export default async function DMPage({ params }: { params: { dmId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: dm } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('id', params.dmId)
    .single()

  if (!dm) redirect('/')

  const otherUserId = dm.user1_id === user.id ? dm.user2_id : dm.user1_id
  const { data: otherUser } = await supabase.from('profiles').select('*').eq('id', otherUserId).single()

  const [{ data: messages }, { data: calls }] = await Promise.all([
    supabase
      .from('dm_messages')
      .select('*, profiles(*)')
      .eq('dm_id', params.dmId)
      .order('created_at', { ascending: true }),
    supabase
      .from('calls')
      .select('*')
      .or(`and(caller_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(caller_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true }),
  ])

  return (
    <DMArea
      dmId={params.dmId}
      otherUser={otherUser as Profile}
      currentUserId={user.id}
      initialMessages={messages ?? []}
      initialCalls={calls ?? []}
    />
  )
}
