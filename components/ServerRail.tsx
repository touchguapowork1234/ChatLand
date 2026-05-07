'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { clsx } from 'clsx'
import type { Server } from '@/lib/types'
import { displayName } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import CreateServerModal from './CreateServerModal'
import JoinServerModal from './JoinServerModal'
import { useUnread } from './UnreadProvider'

interface Props {
  servers: Server[]
  userId: string
}

export default function ServerRail({ servers: initial, userId }: Props) {
  const params = useParams()
  const router = useRouter()
  const [servers, setServers] = useState(initial)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { unreadCounts, dms, groups } = useUnread()

  useEffect(() => {
    const supabase = createClient()

    const fetchCount = async () => {
      const { count } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('status', 'pending')
      setPendingCount(count ?? 0)
    }

    fetchCount()

    const channel = supabase.channel('rail-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, fetchCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const activeId = params?.serverId as string | undefined
  const onFriends = typeof window !== 'undefined' && window.location.pathname === '/friends'

  const handleAdded = (server: Server) => {
    setServers(prev => [...prev, server])
    router.push(`/${server.id}`)
  }

  const iconClass = (active: boolean) =>
    clsx(
      'w-12 h-12 transition-all duration-150 flex items-center justify-center font-bold text-white shrink-0',
      'rounded-[50%] hover:rounded-[16px]',
      active ? 'bg-[#5865f2] rounded-[16px]' : 'bg-[#313338] hover:bg-[#5865f2]'
    )

  return (
    <>
      <div className="w-[72px] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0"
        style={{ background: 'linear-gradient(var(--theme-overlay-rail),var(--theme-overlay-rail)),linear-gradient(to bottom,var(--theme-primary),var(--theme-secondary))' }}>
        {/* Friends */}
        <button onClick={() => router.push('/friends')} title="Friends" className={`relative ${iconClass(onFriends)}`}>
          <Users className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none pointer-events-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        {/* DM / Group unread notifications */}
        {dms.filter(dm => (unreadCounts[dm.id] ?? 0) > 0).map(dm => (
          <button
            key={dm.id}
            onClick={() => router.push(`/dm/${dm.id}`)}
            title={displayName(dm.otherUser)}
            className="relative w-12 h-12 rounded-[50%] hover:rounded-[16px] transition-all duration-150 shrink-0 overflow-hidden bg-[#383a40] flex items-center justify-center text-white text-sm font-bold"
          >
            {dm.otherUser?.avatar_url
              ? <img src={dm.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              : (dm.otherUser?.display_name || dm.otherUser?.username)?.charAt(0).toUpperCase()}
            <span className="absolute bottom-0 right-0 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none">
              {unreadCounts[dm.id] > 99 ? '99+' : unreadCounts[dm.id]}
            </span>
          </button>
        ))}
        {groups.filter(g => (unreadCounts[g.id] ?? 0) > 0).map(g => (
          <button
            key={g.id}
            onClick={() => router.push(`/group/${g.id}`)}
            title={g.name}
            className="relative w-12 h-12 rounded-[50%] hover:rounded-[16px] transition-all duration-150 shrink-0 bg-[#5865f2] flex items-center justify-center"
          >
            <Users className="w-5 h-5 text-white" />
            <span className="absolute bottom-0 right-0 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none">
              {unreadCounts[g.id] > 99 ? '99+' : unreadCounts[g.id]}
            </span>
          </button>
        ))}

        <div className="w-8 h-[2px] bg-[#35373c] rounded-full shrink-0" />

        {servers.map(server => (
          <button
            key={server.id}
            onClick={() => router.push(`/${server.id}`)}
            title={server.name}
            className={iconClass(activeId === server.id)}
          >
            {server.name.charAt(0).toUpperCase()}
          </button>
        ))}

        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            title="Add server"
            className="w-12 h-12 rounded-[50%] hover:rounded-[16px] transition-all duration-150 bg-[#313338] hover:bg-[#23a55a] flex items-center justify-center text-[#23a55a] hover:text-white"
          >
            <Plus className="w-6 h-6" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute left-full ml-3 top-0 bg-[#111214] border border-[#2e3035] rounded-lg shadow-xl p-1.5 z-50 w-44">
                <button
                  onClick={() => { setShowCreate(true); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white rounded-md transition-colors"
                >
                  Create Server
                </button>
                <button
                  onClick={() => { setShowJoin(true); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white rounded-md transition-colors"
                >
                  Join Server
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateServerModal userId={userId} onClose={() => setShowCreate(false)} onCreated={handleAdded} />
      )}
      {showJoin && (
        <JoinServerModal userId={userId} onClose={() => setShowJoin(false)} onJoined={handleAdded} />
      )}
    </>
  )
}
