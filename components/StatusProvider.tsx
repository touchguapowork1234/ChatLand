'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type OnlineStatus = 'online' | 'idle' | 'dnd' | 'offline'

export const STATUS_META: Record<OnlineStatus, { label: string; color: string }> = {
  online:  { label: 'Online',           color: '#23a55a' },
  idle:    { label: 'Idle',             color: '#f0a232' },
  dnd:     { label: 'Do Not Disturb',   color: '#f23f43' },
  offline: { label: 'Offline',          color: '#80848e' },
}

interface StatusCtx {
  status: OnlineStatus
  setStatus: (s: OnlineStatus) => void
}

const StatusContext = createContext<StatusCtx>({ status: 'online', setStatus: () => {} })

export const useStatus = () => useContext(StatusContext)

export default function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusRaw] = useState<OnlineStatus>('online')

  useEffect(() => {
    const saved = localStorage.getItem('online_status') as OnlineStatus | null
    if (saved && saved in STATUS_META) setStatusRaw(saved)
  }, [])

  const setStatus = (s: OnlineStatus) => {
    setStatusRaw(s)
    localStorage.setItem('online_status', s)
  }

  return (
    <StatusContext.Provider value={{ status, setStatus }}>
      {children}
    </StatusContext.Provider>
  )
}
