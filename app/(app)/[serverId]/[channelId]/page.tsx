import { createClient } from '@/lib/supabase/server'
import MessageArea from '@/components/MessageArea'

export default async function ChannelPage({
  params,
}: {
  params: { serverId: string; channelId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: channel }, { data: messages }] = await Promise.all([
    supabase.from('channels').select('*').eq('id', params.channelId).single(),
    supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('channel_id', params.channelId)
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  return (
    <MessageArea
      channelId={params.channelId}
      channelName={channel?.name ?? 'unknown'}
      initialMessages={messages ?? []}
      currentUserId={user?.id ?? ''}
    />
  )
}
