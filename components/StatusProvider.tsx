'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type OnlineStatus = 'online' | 'idle' | 'dnd' | 'offline'

export const STATUS_META: Record<OnlineStatus, { label: string; color: string }> = {
  online:  { label: 'Online',         color: '#23a55a' },
  idle:    { label: 'Idle',           color: '#f0a232' },
  dnd:     { label: 'Do Not Disturb', color: '#f23f43' },
  offline: { label: 'Offline',        color: '#80848e' },
}

interface StatusCtx {
  status: OnlineStatus
  setStatus: (s: OnlineStatus) => void
  getStatus: (userId: string) => OnlineStatus
}

const StatusContext = createContext<StatusCtx>({
  status: 'online',
  setStatus: () => {},
  getStatus: () => 'offline',
})

export const useStatus = () => useContext(StatusContext)

export default function StatusProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = createClient()
  const [status, setStatusRaw] = useState<OnlineStatus>('online')
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineStatus>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const statusRef  = useRef<OnlineStatus>('online')

  useEffect(() => {
    const saved = localStorage.getItem('online_status') as OnlineStatus | null
    // Never restore 'offline' as a preference — come back as online by default
    const initial: OnlineStatus = (saved && saved in STATUS_META && saved !== 'offline') ? saved : 'online'
    setStatusRaw(initial)
    statusRef.current = initial

    const ch = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ status: OnlineStatus }>()
      const map = new Map<string, OnlineStatus>()
      for (const [key, presences] of Object.entries(state)) {
        const p = (presences as Array<{ status?: OnlineStatus }>)[0]
        if (p) map.set(key, p.status ?? 'online')
      }
      setOnlineUsers(map)
    })

    ch.subscribe(async (subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        await ch.track({ status: initial })
      }
    })

    channelRef.current = ch

    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const setStatus = (s: OnlineStatus) => {
    setStatusRaw(s)
    statusRef.current = s
    localStorage.setItem('online_status', s)
    channelRef.current?.track({ status: s })
  }

  const getStatus = (uid: string): OnlineStatus => {
    if (uid === userId) return status
    return onlineUsers.get(uid) ?? 'offline'
  }

  return (
    <StatusContext.Provider value={{ status, setStatus, getStatus }}>
      {children}
    </StatusContext.Provider>
  )
}
