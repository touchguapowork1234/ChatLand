import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ServerPage({ params }: { params: { serverId: string } }) {
  const supabase = await createClient()

  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('server_id', params.serverId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (channel) redirect(`/${params.serverId}/${channel.id}`)

  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <p className="text-[#949ba4]">No channels in this server yet.</p>
    </div>
  )
}
