import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ServerRail from '@/components/ServerRail'
import ChannelSidebar from '@/components/ChannelSidebar'
import CallProvider from '@/components/CallProvider'
import GroupCallProvider from '@/components/GroupCallProvider'
import ProfileCardProvider from '@/components/ProfileCardProvider'
import PremiumThemeProvider from '@/components/PremiumThemeProvider'
import ThemedMain from '@/components/ThemedMain'
import UnreadProvider from '@/components/UnreadProvider'
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
      <GroupCallProvider userId={user.id}>
        <PremiumThemeProvider profile={profile as Profile}>
          <ProfileCardProvider currentUserId={user.id}>
            <UnreadProvider profile={profile as Profile}>
              <div className="flex h-screen overflow-hidden bg-[#1e1f22]">
                <ServerRail servers={servers} userId={user.id} />
                <ChannelSidebar profile={profile as Profile} />
                <ThemedMain>{children}</ThemedMain>
              </div>
            </UnreadProvider>
          </ProfileCardProvider>
        </PremiumThemeProvider>
      </GroupCallProvider>
    </CallProvider>
  )
}
