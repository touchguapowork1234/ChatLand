import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ServerRail from '@/components/ServerRail'
import ChannelSidebar from '@/components/ChannelSidebar'
import CallProvider from '@/components/CallProvider'
import type { Server, Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('server_members').select('server_id').eq('user_id', user.id),
  ])

  const serverIds = (memberships ?? []).map((m: { server_id: string }) => m.server_id)
  let servers: Server[] = []
  if (serverIds.length > 0) {
    const { data } = await supabase.from('servers').select('*').in('id', serverIds)
    servers = data ?? []
  }

  return (
    <CallProvider userId={user.id}>
      <div className="flex h-screen overflow-hidden bg-[#1e1f22]">
        <ServerRail servers={servers} userId={user.id} />
        <ChannelSidebar profile={profile as Profile} />
        <main className="flex-1 flex flex-col bg-[#313338] overflow-hidden min-w-0">
          {children}
        </main>
      </div>
    </CallProvider>
  )
}
