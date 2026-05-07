'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, DirectMessage, GroupChat } from '@/lib/types'

export type DmEntry = DirectMessage & { otherUser: Profile; lastMsg?: string }

interface UnreadCtx {
  unreadCounts: Record<string, number>
  dms: DmEntry[]
  groups: GroupChat[]
  hiddenIds: Set<string>
  saveHidden: (next: Set<string>) => void
  clearUnread: (id: string) => void
  setDms: React.Dispatch<React.SetStateAction<DmEntry[]>>
  setGroups: React.Dispatch<React.SetStateAction<GroupChat[]>>
  reloadDms: () => void
}

const UnreadContext = createContext<UnreadCtx>({
  unreadCounts: {},
  dms: [],
  groups: [],
  hiddenIds: new Set(),
  saveHidden: () => {},
  clearUnread: () => {},
  setDms: () => {},
  setGroups: () => {},
  reloadDms: () => {},
})

export function useUnread() { return useContext(UnreadContext) }

export default function UnreadProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const supabase = createClient()
  const params = useParams()
  const dmId    = params?.dmId    as string | undefined
  const groupId = params?.groupId as string | undefined

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [dms, setDms]       = useState<DmEntry[]>([])
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const currentDmIdRef    = useRef<string | undefined>(undefined)
  const currentGroupIdRef = useRef<string | undefined>(undefined)
  const hiddenIdsRef      = useRef<Set<string>>(new Set())
  const dmsRef            = useRef<DmEntry[]>([])
  const groupsRef         = useRef<GroupChat[]>([])
  // Tracks message IDs already counted to prevent double-counting between realtime + poll
  const countedIdsRef     = useRef<Set<string>>(new Set())
  const lastPollRef       = useRef<string>(new Date().toISOString())

  useEffect(() => { currentDmIdRef.current = dmId },      [dmId])
  useEffect(() => { currentGroupIdRef.current = groupId }, [groupId])
  useEffect(() => { hiddenIdsRef.current = hiddenIds },   [hiddenIds])
  useEffect(() => { dmsRef.current = dms },               [dms])
  useEffect(() => { groupsRef.current = groups },         [groups])

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem(`cl_hidden_dms_${profile.id}`)
      if (s) setHiddenIds(new Set(JSON.parse(s)))
    } catch {}
    try {
      const s = localStorage.getItem(`cl_unread_${profile.id}`)
      if (s) setUnreadCounts(JSON.parse(s))
    } catch {}
  }, [profile.id])

  const saveHidden = useCallback((next: Set<string>) => {
    setHiddenIds(next)
    try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
  }, [profile.id])

  const clearUnread = useCallback((id: string) => {
    setUnreadCounts(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [profile.id])

  const loadDms = useCallback(async () => {
    const [{ data: dmData }, { data: memberRows }] = await Promise.all([
      supabase.from('direct_messages').select('*')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false }),
      supabase.from('group_members').select('group_id').eq('user_id', profile.id),
    ])

    if (dmData) {
      const enriched = await Promise.all(dmData.map(async dm => {
        const otherId = dm.user1_id === profile.id ? dm.user2_id : dm.user1_id
        const [{ data: other }, { data: last }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).single(),
          supabase.from('dm_messages').select('content').eq('dm_id', dm.id)
            .order('created_at', { ascending: false }).limit(1).single(),
        ])
        return { ...dm, otherUser: other as Profile, lastMsg: last?.content }
      }))
      setDms(enriched)
    }

    const groupIds = (memberRows ?? []).map((r: { group_id: string }) => r.group_id)
    if (groupIds.length > 0) {
      const { data: groupData } = await supabase.from('group_chats').select('*')
        .in('id', groupIds).order('created_at', { ascending: false })
      setGroups((groupData ?? []) as GroupChat[])
    } else {
      setGroups([])
    }
  }, [profile.id])

  useEffect(() => { loadDms() }, [profile.id, dmId, groupId])

  // Clear unread and un-hide when navigating into a conversation
  useEffect(() => {
    if (!dmId) return
    clearUnread(dmId)
    if (hiddenIds.has(dmId)) {
      const next = new Set(hiddenIds)
      next.delete(dmId)
      saveHidden(next)
    }
  }, [dmId])

  useEffect(() => {
    if (groupId) clearUnread(groupId)
  }, [groupId])

  const countMsg = (id: string, conversationId: string, type: 'dm' | 'group', dmId_: string | undefined, unhide?: () => void) => {
    if (countedIdsRef.current.has(id)) return
    countedIdsRef.current.add(id)
    if (type === 'dm' && currentDmIdRef.current === conversationId) return
    if (type === 'group' && currentGroupIdRef.current === conversationId) return
    if (unhide) unhide()
    setUnreadCounts(prev => {
      const next = { ...prev, [conversationId]: (prev[conversationId] ?? 0) + 1 }
      try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Realtime unread subscriptions
  useEffect(() => {
    const channel = supabase.channel(`unread_${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, payload => {
        const msg = payload.new as { id: string; dm_id: string; sender_id: string }
        if (msg.sender_id === profile.id) return
        countMsg(msg.id, msg.dm_id, 'dm', undefined, () => {
          if (hiddenIdsRef.current.has(msg.dm_id)) {
            const next = new Set(hiddenIdsRef.current)
            next.delete(msg.dm_id)
            setHiddenIds(next)
            try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
          }
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, payload => {
        const msg = payload.new as { id: string; group_id: string; sender_id: string; type?: string }
        if (msg.sender_id === profile.id) return
        if (msg.type === 'system') return
        countMsg(msg.id, msg.group_id, 'group', undefined)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  // Polling fallback — catches unread messages that realtime missed
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      const since = lastPollRef.current
      lastPollRef.current = new Date().toISOString()

      const dmIds = dmsRef.current.map(d => d.id)
      if (dmIds.length > 0) {
        const { data } = await supabase
          .from('dm_messages')
          .select('id, dm_id, sender_id')
          .in('dm_id', dmIds)
          .neq('sender_id', profile.id)
          .gt('created_at', since)
        for (const m of (data ?? []) as { id: string; dm_id: string; sender_id: string }[]) {
          countMsg(m.id, m.dm_id, 'dm', undefined, () => {
            if (hiddenIdsRef.current.has(m.dm_id)) {
              const next = new Set(hiddenIdsRef.current)
              next.delete(m.dm_id)
              setHiddenIds(next)
              try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
            }
          })
        }
      }

      const groupIds = groupsRef.current.map(g => g.id)
      if (groupIds.length > 0) {
        const { data } = await supabase
          .from('group_messages')
          .select('id, group_id, sender_id, type')
          .in('group_id', groupIds)
          .neq('sender_id', profile.id)
          .gt('created_at', since)
        for (const m of (data ?? []) as { id: string; group_id: string; sender_id: string; type?: string }[]) {
          if (m.type === 'system') continue
          countMsg(m.id, m.group_id, 'group', undefined)
        }
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [profile.id])

  return (
    <UnreadContext.Provider value={{ unreadCounts, dms, groups, hiddenIds, saveHidden, clearUnread, setDms, setGroups, reloadDms: loadDms }}>
      {children}
    </UnreadContext.Provider>
  )
}
