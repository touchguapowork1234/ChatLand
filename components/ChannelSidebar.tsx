'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Hash, Plus, Copy, Check, UserPlus, X, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Channel, Profile, Server, DirectMessage, GroupChat } from '@/lib/types'
import { displayName } from '@/lib/types'
import UserPanel from './UserPanel'
import CreateGroupModal from './CreateGroupModal'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'

type DmEntry = DirectMessage & { otherUser: Profile; lastMsg?: string }

export default function ChannelSidebar({ profile }: { profile: Profile }) {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { openProfile } = useProfileCard()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; userId: string } | null>(null)

  const serverId  = params?.serverId  as string | undefined
  const channelId = params?.channelId as string | undefined
  const dmId      = params?.dmId      as string | undefined
  const groupId   = params?.groupId   as string | undefined

  const [server, setServer]     = useState<Server | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [dms, setDms]           = useState<DmEntry[]>([])
  const [groups, setGroups]     = useState<GroupChat[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string; isOwner: boolean } | null>(null)

  // Refs to avoid stale closures in realtime callbacks
  const currentDmIdRef    = useRef<string | undefined>(undefined)
  const currentGroupIdRef = useRef<string | undefined>(undefined)
  const hiddenIdsRef      = useRef<Set<string>>(new Set())

  useEffect(() => { currentDmIdRef.current = dmId },      [dmId])
  useEffect(() => { currentGroupIdRef.current = groupId }, [groupId])
  useEffect(() => { hiddenIdsRef.current = hiddenIds },   [hiddenIds])

  // Load hidden DM IDs from localStorage
  useEffect(() => {
    const key = `cl_hidden_dms_${profile.id}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) setHiddenIds(new Set(JSON.parse(stored)))
    } catch {}
  }, [profile.id])

  // Load unread counts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`cl_unread_${profile.id}`)
      if (stored) setUnreadCounts(JSON.parse(stored))
    } catch {}
  }, [profile.id])

  // Load blocked user IDs + friend IDs
  useEffect(() => {
    if (serverId) return
    supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id)
      .then(({ data }) => setBlockedIds(new Set((data ?? []).map((b: { blocked_id: string }) => b.blocked_id))))
    supabase.from('friend_requests').select('sender_id, receiver_id')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .then(({ data }) => setFriendIds(new Set((data ?? []).map((r: { sender_id: string; receiver_id: string }) =>
        r.sender_id === profile.id ? r.receiver_id : r.sender_id
      ))))
  }, [profile.id, serverId])

  // Realtime unread count subscriptions
  useEffect(() => {
    if (serverId) return

    const channel = supabase
      .channel(`unread_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages' },
        (payload) => {
          const msg = payload.new as { dm_id: string; sender_id: string }
          if (msg.sender_id === profile.id) return
          if (currentDmIdRef.current === msg.dm_id) return
          // Un-hide if hidden
          if (hiddenIdsRef.current.has(msg.dm_id)) {
            const next = new Set(hiddenIdsRef.current)
            next.delete(msg.dm_id)
            setHiddenIds(next)
            try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
          }
          setUnreadCounts(prev => {
            const next = { ...prev, [msg.dm_id]: (prev[msg.dm_id] ?? 0) + 1 }
            try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        (payload) => {
          const msg = payload.new as { group_id: string; sender_id: string; type?: string }
          if (msg.sender_id === profile.id) return
          if (msg.type === 'system') return
          if (currentGroupIdRef.current === msg.group_id) return
          setUnreadCounts(prev => {
            const next = { ...prev, [msg.group_id]: (prev[msg.group_id] ?? 0) + 1 }
            try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
            return next
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile.id, serverId])

  // Clear unread when navigating into a DM
  useEffect(() => {
    if (!dmId) return
    setUnreadCounts(prev => {
      if (!prev[dmId]) return prev
      const next = { ...prev }
      delete next[dmId]
      try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [dmId])

  // Clear unread when navigating into a group
  useEffect(() => {
    if (!groupId) return
    setUnreadCounts(prev => {
      if (!prev[groupId]) return prev
      const next = { ...prev }
      delete next[groupId]
      try { localStorage.setItem(`cl_unread_${profile.id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [groupId])

  const blockDMUser = async (userId: string) => {
    await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: userId })
    setBlockedIds(prev => new Set([...prev, userId]))
  }

  const unblockDMUser = async (userId: string) => {
    await supabase.from('blocks').delete().eq('blocker_id', profile.id).eq('blocked_id', userId)
    setBlockedIds(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  const removeDMFriend = async (userId: string) => {
    await supabase.rpc('remove_friend', { friend_user_id: userId })
    setFriendIds(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  const saveHidden = (next: Set<string>) => {
    setHiddenIds(next)
    try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
  }

  const hideDM = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const next = new Set(hiddenIds)
    next.add(id)
    saveHidden(next)
    if (dmId === id) router.push('/')
  }

  // Un-hide the DM you navigate into
  useEffect(() => {
    if (dmId && hiddenIds.has(dmId)) {
      const next = new Set(hiddenIds)
      next.delete(dmId)
      saveHidden(next)
    }
  }, [dmId])

  // Server mode
  useEffect(() => {
    if (!serverId) { setServer(null); setChannels([]); return }
    supabase.from('servers').select('*').eq('id', serverId).single()
      .then(({ data }) => setServer(data))
    supabase.from('channels').select('*').eq('server_id', serverId).order('created_at', { ascending: true })
      .then(({ data }) => setChannels(data ?? []))
  }, [serverId])

  // DM mode — refetch whenever dmId/groupId changes so new conversations appear immediately
  useEffect(() => {
    if (serverId) return
    const load = async () => {
      const [{ data: dmData }, { data: memberRows }] = await Promise.all([
        supabase
          .from('direct_messages')
          .select('*')
          .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', profile.id),
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

      const groupIds = (memberRows ?? []).map(r => r.group_id)
      if (groupIds.length > 0) {
        const { data: groupData } = await supabase
          .from('group_chats')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false })
        setGroups((groupData ?? []) as GroupChat[])
      } else {
        setGroups([])
      }
    }
    load()
  }, [serverId, profile.id, dmId, groupId])

  const createChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || !serverId) return
    const { data } = await supabase.from('channels').insert({ server_id: serverId, name }).select().single()
    if (data) {
      setChannels(prev => [...prev, data])
      setNewChannelName('')
      setShowNewChannel(false)
      router.push(`/${serverId}/${data.id}`)
    }
  }

  const copyInvite = async () => {
    if (!server?.invite_code) return
    await navigator.clipboard.writeText(server.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveGroup = async (gId: string) => {
    const name = profile.display_name || profile.username
    await supabase.from('group_messages').insert({
      group_id: gId,
      sender_id: profile.id,
      content: `${name} left the group`,
      type: 'system',
    })
    await supabase.from('group_members').delete().eq('group_id', gId).eq('user_id', profile.id)
    setGroups(prev => prev.filter(g => g.id !== gId))
    if (groupId === gId) router.push('/')
  }

  const deleteGroup = async (gId: string) => {
    await supabase.from('group_chats').delete().eq('id', gId).eq('created_by', profile.id)
    setGroups(prev => prev.filter(g => g.id !== gId))
    if (groupId === gId) router.push('/')
  }

  // ── DM sidebar (no server selected) ──
  if (!serverId) {
    const visibleDMs = dms.filter(dm => !hiddenIds.has(dm.id))

    return (
      <>
        {showCreateGroup && (
          <CreateGroupModal currentUserId={profile.id} onClose={() => setShowCreateGroup(false)} />
        )}
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
            items={[
              { label: 'View Profile', onClick: () => openProfile(ctxMenu.userId) },
              ...(friendIds.has(ctxMenu.userId)
                ? [{ label: 'Remove Friend', danger: true, onClick: () => removeDMFriend(ctxMenu.userId) }]
                : []),
              blockedIds.has(ctxMenu.userId)
                ? { label: 'Unblock', onClick: () => unblockDMUser(ctxMenu.userId) }
                : { label: 'Block', danger: true, onClick: () => blockDMUser(ctxMenu.userId) },
            ]}
          />
        )}
        {groupCtxMenu && (
          <ContextMenu
            x={groupCtxMenu.x} y={groupCtxMenu.y}
            onClose={() => setGroupCtxMenu(null)}
            items={[
              ...(groupCtxMenu.isOwner ? [{ label: 'Delete Group', danger: true, onClick: () => deleteGroup(groupCtxMenu.groupId) }] : []),
              { label: 'Leave Group', danger: true, onClick: () => leaveGroup(groupCtxMenu.groupId) },
            ]}
          />
        )}
        <div className="w-60 flex flex-col shrink-0" style={{ background: 'linear-gradient(var(--theme-overlay-sidebar),var(--theme-overlay-sidebar)),linear-gradient(to bottom,var(--theme-primary),var(--theme-secondary))' }}>
          <div className="p-3 border-b border-[#1e1f22] flex items-center gap-2">
            <button
              onClick={() => router.push('/friends')}
              className="flex-1 flex items-center gap-2 px-2 py-2 rounded text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              Friends
            </button>
            <button
              onClick={() => setShowCreateGroup(true)}
              title="New Group Chat"
              className="p-2 rounded text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors shrink-0"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {/* Direct Messages */}
            <div className="px-2 pt-2 pb-1">
              <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Direct Messages</p>
            </div>
            {visibleDMs.map(dm => (
              <div key={dm.id} className="group relative"
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, userId: dm.otherUser?.id }) }}>
                <button
                  onClick={() => router.push(`/dm/${dm.id}`)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-2 rounded transition-colors pr-8',
                    dmId === dm.id
                      ? 'bg-[#404249] text-[#dbdee1]'
                      : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                  )}
                >
                  <div className="relative w-8 h-8 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-xs font-bold select-none">
                      {dm.otherUser?.avatar_url
                        ? <img src={dm.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (dm.otherUser?.display_name || dm.otherUser?.username)?.charAt(0).toUpperCase()}
                    </div>
                    {(unreadCounts[dm.id] ?? 0) > 0 && (
                      <span
                        title={displayName(dm.otherUser)}
                        className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none"
                      >
                        {unreadCounts[dm.id] > 99 ? '99+' : unreadCounts[dm.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{displayName(dm.otherUser)}</p>
                    {dm.lastMsg && (
                      <p className="text-xs text-[#6d6f78] truncate">{dm.lastMsg}</p>
                    )}
                  </div>
                </button>
                <button
                  onClick={e => hideDM(dm.id, e)}
                  title="Close DM"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#404249]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {visibleDMs.length === 0 && (
              <p className="text-xs text-[#4e5058] px-2 mt-1 mb-2">No direct messages yet</p>
            )}

            {/* Group Chats */}
            {groups.length > 0 && (
              <>
                <div className="px-2 pt-4 pb-1">
                  <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Group Chats</p>
                </div>
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => router.push(`/group/${g.id}`)}
                    onContextMenu={e => {
                      e.preventDefault()
                      setGroupCtxMenu({ x: e.clientX, y: e.clientY, groupId: g.id, isOwner: g.created_by === profile.id })
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-2 rounded transition-colors',
                      groupId === g.id
                        ? 'bg-[#404249] text-[#dbdee1]'
                        : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                    )}
                  >
                    <div className="relative w-8 h-8 shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      {(unreadCounts[g.id] ?? 0) > 0 && (
                        <span
                          title={g.name}
                          className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none"
                        >
                          {unreadCounts[g.id] > 99 ? '99+' : unreadCounts[g.id]}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium truncate flex-1 text-left">{g.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          <UserPanel profile={profile} />
        </div>
      </>
    )
  }

  // ── Channel sidebar (server selected) ──
  const isOwner = profile?.id === server?.owner_id

  return (
    <div className="w-60 flex flex-col shrink-0" style={{ background: 'linear-gradient(var(--theme-overlay-sidebar),var(--theme-overlay-sidebar)),linear-gradient(to bottom,var(--theme-primary),var(--theme-secondary))' }}>
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm">
        <h2 className="font-bold text-[#dbdee1] truncate">{server?.name ?? '…'}</h2>
        {server?.invite_code && (
          <button onClick={copyInvite} title="Copy invite code"
            className="text-[#949ba4] hover:text-[#dbdee1] transition-colors ml-2 shrink-0">
            {copied ? <Check className="w-4 h-4 text-[#23a55a]" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Text Channels</span>
          {isOwner && (
            <button onClick={() => setShowNewChannel(v => !v)}
              className="text-[#949ba4] hover:text-[#dbdee1] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {showNewChannel && (
          <div className="px-2 mb-2">
            <input
              type="text"
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createChannel(); if (e.key === 'Escape') setShowNewChannel(false) }}
              placeholder="new-channel"
              autoFocus
              className="w-full bg-[#1e1f22] text-[#dbdee1] text-sm px-2 py-1.5 rounded outline-none placeholder-[#949ba4]"
            />
          </div>
        )}

        {channels.map(ch => (
          <button key={ch.id}
            onClick={() => router.push(`/${serverId}/${ch.id}`)}
            className={clsx(
              'w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors',
              channelId === ch.id
                ? 'bg-[#404249] text-[#dbdee1]'
                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
            )}>
            <Hash className="w-4 h-4 shrink-0" />
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </div>

      <UserPanel profile={profile} />
    </div>
  )
}
