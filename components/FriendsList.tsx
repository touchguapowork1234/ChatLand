'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Phone, Check, X, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCall } from '@/components/CallProvider'
import type { FriendRequest, Profile } from '@/lib/types'
import { displayName } from '@/lib/types'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'

type Tab = 'friends' | 'pending' | 'add'

interface Friend {
  requestId: string
  profile: Profile
}

export default function FriendsList({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { startCall } = useCall()

  const { openProfile } = useProfileCard()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; userId: string; requestId?: string } | null>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [addInput, setAddInput] = useState('')
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const { data: accepted } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)

    setFriends(
      (accepted ?? []).map(r => ({
        requestId: r.id,
        profile: (r.sender_id === currentUserId ? r.receiver : r.sender) as unknown as Profile,
      }))
    )

    const { data: pend } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .eq('status', 'pending')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)

    setIncoming((pend ?? []).filter(r => r.receiver_id === currentUserId) as FriendRequest[])
    setOutgoing((pend ?? []).filter(r => r.sender_id === currentUserId) as FriendRequest[])
  }

  const loadBlocks = async () => {
    const { data } = await supabase
      .from('blocks').select('blocked_id').eq('blocker_id', currentUserId)
    setBlockedIds(new Set((data ?? []).map((b: { blocked_id: string }) => b.blocked_id)))
  }

  useEffect(() => {
    load()
    loadBlocks()

    const channel = supabase.channel('friends-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const removeFriend = async (requestId: string) => {
    await supabase.from('friend_requests').delete().eq('id', requestId)
    setFriends(prev => prev.filter(f => f.requestId !== requestId))
  }

  const blockUser = async (userId: string) => {
    await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: userId })
    setBlockedIds(prev => new Set([...prev, userId]))
    // Also remove friendship so they can't add to groups
    const friend = friends.find(f => f.profile.id === userId)
    if (friend) {
      await supabase.from('friend_requests').delete().eq('id', friend.requestId)
      setFriends(prev => prev.filter(f => f.profile.id !== userId))
    }
  }

  const unblockUser = async (userId: string) => {
    await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', userId)
    setBlockedIds(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  const openDM = async (otherId: string) => {
    const [u1, u2] = [currentUserId, otherId].sort()
    const { data: existing } = await supabase
      .from('direct_messages').select('id').eq('user1_id', u1).eq('user2_id', u2).single()
    if (existing) { router.push(`/dm/${existing.id}`); return }
    const { data: created } = await supabase
      .from('direct_messages').insert({ user1_id: u1, user2_id: u2 }).select('id').single()
    if (created) router.push(`/dm/${created.id}`)
  }

  const accept = async (id: string) => {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', id)
    load()
  }

  const decline = async (id: string) => {
    await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', id)
    load()
  }

  const cancel = async (id: string) => {
    await supabase.from('friend_requests').delete().eq('id', id)
    load()
  }

  const sendRequest = async () => {
    setAddStatus(null)
    const match = addInput.trim().match(/^(.+)#(\d{4})$/)
    if (!match) {
      setAddStatus({ type: 'error', msg: 'Use the format username#0000' })
      return
    }
    const [, name, tag] = match
    setLoading(true)

    const { data: target } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .eq('tag', tag)
      .single()

    if (!target) {
      setAddStatus({ type: 'error', msg: 'User not found.' })
      setLoading(false)
      return
    }
    if (target.id === currentUserId) {
      setAddStatus({ type: 'error', msg: "That's you!" })
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert({ sender_id: currentUserId, receiver_id: target.id })

    if (error) {
      setAddStatus({ type: 'error', msg: error.code === '23505' ? 'Request already sent.' : 'Failed to send request.' })
    } else {
      setAddStatus({ type: 'success', msg: `Friend request sent to ${addInput.trim()}!` })
      setAddInput('')
      load()
    }
    setLoading(false)
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: 'All Friends', count: friends.length },
    { key: 'pending', label: 'Pending', count: incoming.length || undefined },
    { key: 'add', label: 'Add Friend' },
  ]

  return (
    <div className="flex flex-col h-full" onContextMenu={e => e.preventDefault()}>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'View Profile', onClick: () => openProfile(ctxMenu.userId) },
            ...(ctxMenu.requestId
              ? [{ label: 'Remove Friend', danger: true, onClick: () => removeFriend(ctxMenu.requestId!) }]
              : []),
            blockedIds.has(ctxMenu.userId)
              ? { label: 'Unblock', onClick: () => unblockUser(ctxMenu.userId) }
              : { label: 'Block', danger: true, onClick: () => blockUser(ctxMenu.userId) },
          ]}
        />
      )}
      <div className="h-12 px-4 flex items-center gap-4 border-b border-[#1e1f22] shrink-0 shadow-sm">
        <UserPlus className="w-5 h-5 text-[#dbdee1]" />
        <span className="font-semibold text-[#dbdee1]">Friends</span>
        <div className="w-px h-5 bg-[#3f4147]" />
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-1 rounded transition-colors font-medium flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-[#404249] text-[#dbdee1]'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]'
            }`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* All Friends */}
        {tab === 'friends' && (
          <>
            {friends.length === 0 ? (
              <div className="text-center text-[#949ba4] mt-20">
                <p className="text-lg font-semibold text-[#dbdee1] mb-1">No friends yet</p>
                <p className="text-sm">Add friends using the <span className="text-[#dbdee1]">Add Friend</span> tab.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-[#949ba4] mb-3">
                  All Friends — {friends.length}
                </p>
                {friends.map(({ requestId, profile }) => (
                  <div key={requestId}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, userId: profile.id, requestId }) }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#35373c] group transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
                      {profile.avatar_url
                        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (profile.display_name || profile.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#dbdee1] text-sm">{displayName(profile)}</p>
                      <p className="text-xs text-[#949ba4]">Online</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDM(profile.id)} title="Message"
                        className="w-9 h-9 rounded-full bg-[#383a40] hover:bg-[#5865f2] flex items-center justify-center text-[#dbdee1] transition-colors">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button onClick={() => startCall(profile.id, profile)} title="Call"
                        className="w-9 h-9 rounded-full bg-[#383a40] hover:bg-[#23a55a] flex items-center justify-center text-[#dbdee1] transition-colors">
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pending */}
        {tab === 'pending' && (
          <div className="space-y-4">
            {incoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-[#949ba4] mb-3">
                  Incoming — {incoming.length}
                </p>
                <div className="space-y-1">
                  {incoming.map(req => (
                    <div key={req.id}
                      onContextMenu={e => { e.preventDefault(); req.sender?.id && setCtxMenu({ x: e.clientX, y: e.clientY, userId: req.sender.id }) }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#35373c] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
                        {req.sender?.avatar_url
                          ? <img src={req.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (req.sender?.display_name || req.sender?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#dbdee1] text-sm">{displayName(req.sender)}</p>
                        <p className="text-xs text-[#949ba4]">Incoming Friend Request</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => accept(req.id)}
                          className="w-9 h-9 rounded-full bg-[#383a40] hover:bg-[#23a55a] flex items-center justify-center text-[#dbdee1] transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => decline(req.id)}
                          className="w-9 h-9 rounded-full bg-[#383a40] hover:bg-red-500 flex items-center justify-center text-[#dbdee1] transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {outgoing.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-[#949ba4] mb-3">
                  Outgoing — {outgoing.length}
                </p>
                <div className="space-y-1">
                  {outgoing.map(req => (
                    <div key={req.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#35373c] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
                        {req.receiver?.avatar_url
                          ? <img src={req.receiver.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (req.receiver?.display_name || req.receiver?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#dbdee1] text-sm">{displayName(req.receiver)}</p>
                        <p className="text-xs text-[#949ba4]">Outgoing Friend Request</p>
                      </div>
                      <button onClick={() => cancel(req.id)}
                        className="w-9 h-9 rounded-full bg-[#383a40] hover:bg-red-500 flex items-center justify-center text-[#dbdee1] transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="text-center text-[#949ba4] mt-20">
                <p className="text-sm">No pending friend requests.</p>
              </div>
            )}
          </div>
        )}

        {/* Add Friend */}
        {tab === 'add' && (
          <div className="max-w-lg">
            <h3 className="text-xl font-bold text-[#dbdee1] mb-1">Add Friend</h3>
            <p className="text-[#949ba4] text-sm mb-6">
              You can add friends using their ChatLand username and tag (e.g. <span className="text-[#dbdee1]">snow#0023</span>).
            </p>
            <div className="bg-[#1e1f22] rounded-lg p-1 flex gap-2">
              <input
                type="text"
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddStatus(null) }}
                onKeyDown={e => e.key === 'Enter' && sendRequest()}
                placeholder="username#0000"
                className="flex-1 bg-transparent text-[#dbdee1] px-3 py-2 outline-none placeholder-[#4e5058] text-sm"
              />
              <button onClick={sendRequest} disabled={!addInput.trim() || loading}
                className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors">
                {loading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
            {addStatus && (
              <p className={`text-sm mt-3 ${addStatus.type === 'success' ? 'text-[#23a55a]' : 'text-red-400'}`}>
                {addStatus.msg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
