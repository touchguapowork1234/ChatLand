import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupArea from '@/components/GroupArea'
import type { GroupChat, GroupMember, GroupMessage } from '@/lib/types'

export default async function GroupPage({ params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Verify membership
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', params.groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/')

  const [{ data: group }, { data: messages }, { data: members }] = await Promise.all([
    supabase.from('group_chats').select('*').eq('id', params.groupId).single(),
    supabase.from('group_messages').select('*, profiles(*)').eq('group_id', params.groupId)
      .order('created_at', { ascending: true }).limit(100),
    supabase.from('group_members').select('*, profiles(*)').eq('group_id', params.groupId),
  ])

  if (!group) redirect('/')

  return (
    <GroupArea
      group={group as GroupChat}
      initialMessages={(messages ?? []) as GroupMessage[]}
      initialMembers={(members ?? []) as GroupMember[]}
      currentUserId={user.id}
    />
  )
}
