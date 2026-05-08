'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Hash, Plus, Copy, Check, UserPlus, X, Users, Bot } from 'lucide-react'
import { DmShootingStarsOverlay, DmSnowOverlay, DmBloodmoonOverlay, DmBluemoonOverlay, DmSolarOverlay } from './DmHoverAnimations'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Channel, Profile, Server } from '@/lib/types'
import { displayName } from '@/lib/types'
import UserPanel from './UserPanel'
import CreateGroupModal from './CreateGroupModal'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'
import { useUnread } from './UnreadProvider'
import GroupIconCropModal from './GroupIconCropModal'

export default function ChannelSidebar({ profile }: { profile: Profile }) {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { openProfile } = useProfileCard()
  const { dms, groups, hiddenIds, saveHidden, unreadCounts, clearUnread, setGroups } = useUnread()

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; userId: string } | null>(null)
  const [nicknames, setNicknames]         = useState<Map<string, string>>(new Map())
  const [nicknameModal, setNicknameModal] = useState<{ friendId: string; friendName: string } | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')

  const serverId  = params?.serverId  as string | undefined
  const channelId = params?.channelId as string | undefined
  const dmId      = params?.dmId      as string | undefined
  const groupId   = params?.groupId   as string | undefined

  const [server, setServer]     = useState<Server | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string; isOwner: boolean } | null>(null)
  const [showNameModal, setShowNameModal] = useState<{ groupId: string; currentName: string } | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [iconUploadGroupId, setIconUploadGroupId] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<{ file: File; groupId: string } | null>(null)
  const groupIconInputRef = useRef<HTMLInputElement>(null)
  const [aiCharacter, setAiCharacter] = useState<{ name: string; avatar_url: string | null } | null>(null)
  const [hoveredDmId, setHoveredDmId] = useState<string | null>(null)
  const [hasAiAccess, setHasAiAccess] = useState(profile.has_ai_access ?? false)
  const [hideAi, setHideAi] = useState(profile.hide_ai ?? false)

  // Load blocked user IDs + friend IDs + nicknames
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
    supabase.from('friend_nicknames').select('friend_id, nickname').eq('user_id', profile.id)
      .then(({ data }) => {
        const map = new Map<string, string>()
        ;(data ?? []).forEach((n: { friend_id: string; nickname: string }) => map.set(n.friend_id, n.nickname))
        setNicknames(map)
      })
    if (profile.has_ai_access) {
      supabase.from('ai_character').select('name, avatar_url').eq('id', 1).single()
        .then(({ data }) => { if (data) setAiCharacter(data as { name: string; avatar_url: string | null }) })
    }
  }, [profile.id, serverId])

  // Poll every 5s for AI access + character updates
  useEffect(() => {
    if (serverId) return
    const poll = async () => {
      const { data: prof } = await supabase
        .from('profiles').select('has_ai_access, hide_ai').eq('id', profile.id).single()
      if (prof?.hide_ai !== undefined) setHideAi(prof.hide_ai)
      if (!prof?.has_ai_access) return
      setHasAiAccess(true)
      const { data: char } = await supabase
        .from('ai_character').select('name, avatar_url').eq('id', 1).single()
      if (char) setAiCharacter(char as { name: string; avatar_url: string | null })
    }
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [profile.id, serverId])

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

  const openNicknameModal = (friendId: string, friendName: string) => {
    setNicknameInput(nicknames.get(friendId) ?? '')
    setNicknameModal({ friendId, friendName })
  }

  const saveNickname = async () => {
    if (!nicknameModal) return
    const trimmed = nicknameInput.trim()
    if (!trimmed) {
      await supabase.from('friend_nicknames').delete().eq('user_id', profile.id).eq('friend_id', nicknameModal.friendId)
      setNicknames(prev => { const m = new Map(prev); m.delete(nicknameModal.friendId); return m })
    } else {
      await supabase.from('friend_nicknames').upsert(
        { user_id: profile.id, friend_id: nicknameModal.friendId, nickname: trimmed },
        { onConflict: 'user_id,friend_id' }
      )
      setNicknames(prev => new Map(prev).set(nicknameModal.friendId, trimmed))
    }
    setNicknameModal(null)
  }

  const removeNickname = async (friendId: string) => {
    await supabase.from('friend_nicknames').delete().eq('user_id', profile.id).eq('friend_id', friendId)
    setNicknames(prev => { const m = new Map(prev); m.delete(friendId); return m })
    setNicknameModal(null)
  }

  const hideDM = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const next = new Set(hiddenIds)
    next.add(id)
    saveHidden(next)
    if (dmId === id) router.push('/')
  }

  // Server mode
  useEffect(() => {
    if (!serverId) { setServer(null); setChannels([]); return }
    supabase.from('servers').select('*').eq('id', serverId).single()
      .then(({ data }) => setServer(data))
    supabase.from('channels').select('*').eq('server_id', serverId).order('created_at', { ascending: true })
      .then(({ data }) => setChannels(data ?? []))
  }, [serverId])

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

  const submitNameChange = async () => {
    if (!showNameModal) return
    const name = newGroupName.trim()
    if (!name || name === showNameModal.currentName) { setShowNameModal(null); return }
    const { gId } = { gId: showNameModal.groupId }
    setShowNameModal(null)
    await supabase.from('group_chats').update({ name }).eq('id', gId)
    setGroups(prev => prev.map(g => g.id === gId ? { ...g, name } : g))
    const actor = profile.display_name || profile.username
    await supabase.from('group_messages').insert({
      group_id: gId, sender_id: profile.id,
      content: `${actor} changed the group name to "${name}"`, type: 'system',
    })
  }

  // Step 1: file selected → show crop modal
  const handleGroupIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !iconUploadGroupId) { setIconUploadGroupId(null); return }
    if (!file.type.startsWith('image/')) { setIconUploadGroupId(null); return }
    setCropFile({ file, groupId: iconUploadGroupId })
    setIconUploadGroupId(null)
  }

  // Step 2: crop saved → upload blob and update group
  const handleCropSave = async (blob: Blob) => {
    if (!cropFile) return
    const { groupId: gId } = cropFile
    setCropFile(null)
    // Path under the user's folder so storage policy allows it
    const path = `${profile.id}/group-icons/${crypto.randomUUID()}.png`
    const { error } = await supabase.storage.from('chat-files').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (error) return
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path)
    const icon_url = urlData.publicUrl
    await supabase.from('group_chats').update({ icon_url }).eq('id', gId)
    setGroups(prev => prev.map(g => g.id === gId ? { ...g, icon_url } : g))
    const actor = profile.display_name || profile.username
    await supabase.from('group_messages').insert({
      group_id: gId, sender_id: profile.id,
      content: `${actor} changed the group icon`, type: 'system',
    })
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
              ...(friendIds.has(ctxMenu.userId) ? [
                {
                  label: nicknames.has(ctxMenu.userId) ? 'Edit Nickname' : 'Add Nickname',
                  onClick: () => {
                    const dm = dms.find(d => d.otherUser?.id === ctxMenu.userId)
                    openNicknameModal(ctxMenu.userId, displayName(dm?.otherUser))
                  },
                },
                { label: 'Remove Friend', danger: true, onClick: () => removeDMFriend(ctxMenu.userId) },
              ] : []),
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
              {
                label: 'Change Name',
                onClick: () => {
                  const g = groups.find(g => g.id === groupCtxMenu.groupId)
                  setNewGroupName(g?.name ?? '')
                  setShowNameModal({ groupId: groupCtxMenu.groupId, currentName: g?.name ?? '' })
                },
              },
              {
                label: 'Change Icon',
                onClick: () => {
                  setIconUploadGroupId(groupCtxMenu.groupId)
                  groupIconInputRef.current?.click()
                },
              },
              ...(groupCtxMenu.isOwner ? [{ label: 'Delete Group', danger: true, onClick: () => deleteGroup(groupCtxMenu.groupId) }] : []),
              { label: 'Leave Group', danger: true, onClick: () => leaveGroup(groupCtxMenu.groupId) },
            ]}
          />
        )}
        {/* Hidden file input for group icon upload */}
        <input
          ref={groupIconInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGroupIconChange}
        />
        {/* Crop modal */}
        {cropFile && (
          <GroupIconCropModal
            file={cropFile.file}
            onSave={handleCropSave}
            onCancel={() => setCropFile(null)}
          />
        )}
        {/* Change Name modal */}
        {showNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowNameModal(null)}>
            <div className="bg-[#2b2d31] rounded-lg p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[#dbdee1] font-semibold mb-1">Change Group Name</h3>
              <p className="text-xs text-[#949ba4] mb-3">Enter a new name for this group.</p>
              <input
                autoFocus
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitNameChange(); if (e.key === 'Escape') setShowNameModal(null) }}
                maxLength={50}
                className="w-full bg-[#1e1f22] text-[#dbdee1] px-3 py-2 rounded text-sm outline-none placeholder-[#949ba4]"
                placeholder="Group name"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowNameModal(null)} className="px-3 py-1.5 text-sm text-[#949ba4] hover:text-[#dbdee1] transition-colors">Cancel</button>
                <button onClick={submitNameChange} className="px-3 py-1.5 text-sm bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition-colors">Save</button>
              </div>
            </div>
          </div>
        )}
        {nicknameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={e => { if (e.target === e.currentTarget) setNicknameModal(null) }}>
            <div className="bg-[#2b2d31] rounded-xl shadow-2xl w-[360px] p-6">
              <h2 className="text-lg font-bold text-[#dbdee1] mb-1">
                {nicknames.has(nicknameModal.friendId) ? 'Edit Nickname' : 'Add Nickname'}
              </h2>
              <p className="text-sm text-[#949ba4] mb-4">for <span className="text-[#dbdee1]">{nicknameModal.friendName}</span></p>
              <input
                autoFocus
                type="text"
                value={nicknameInput}
                onChange={e => setNicknameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setNicknameModal(null) }}
                placeholder="Enter a nickname…"
                maxLength={32}
                className="w-full bg-[#1e1f22] text-[#dbdee1] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5865f2] mb-4"
              />
              <div className="flex items-center gap-2 justify-end">
                {nicknames.has(nicknameModal.friendId) && (
                  <button onClick={() => removeNickname(nicknameModal.friendId)} className="text-sm text-red-400 hover:text-red-300 mr-auto transition-colors">
                    Remove Nickname
                  </button>
                )}
                <button onClick={() => setNicknameModal(null)} className="px-4 py-1.5 rounded-lg text-sm text-[#949ba4] hover:text-[#dbdee1] transition-colors">Cancel</button>
                <button onClick={saveNickname} className="px-4 py-1.5 rounded-lg text-sm bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium transition-colors">Save</button>
              </div>
            </div>
          </div>
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
            {/* AI Chatbot */}
            {hasAiAccess && aiCharacter && !hideAi && (
              <>
                <div className="px-2 pt-2 pb-1">
                  <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">AI</p>
                </div>
                <button
                  onClick={() => router.push('/ejafterlyfe-ai')}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-2 rounded transition-colors mb-1',
                    pathname === '/ejafterlyfe-ai'
                      ? 'bg-[#404249] text-[#dbdee1]'
                      : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden shrink-0 flex items-center justify-center">
                    {aiCharacter.avatar_url
                      ? <img src={aiCharacter.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{aiCharacter.name}</p>
                    <p className="text-xs text-[#6d6f78] truncate">AI Assistant</p>
                  </div>
                </button>
              </>
            )}

            {/* Direct Messages */}
            <div className="px-2 pt-2 pb-1">
              <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Direct Messages</p>
            </div>
            {visibleDMs.map(dm => (
              <div key={dm.id} className="group relative"
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, userId: dm.otherUser?.id }) }}>
                <button
                  onClick={() => router.push(`/dm/${dm.id}`)}
                  onMouseEnter={() => setHoveredDmId(dm.id)}
                  onMouseLeave={() => setHoveredDmId(null)}
                  className={clsx(
                    'relative overflow-hidden w-full flex items-center gap-2 px-2 py-2 rounded transition-colors pr-8',
                    dmId === dm.id
                      ? 'bg-[#404249] text-[#dbdee1]'
                      : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                  )}
                >
                  {dm.otherUser?.is_premium && dm.otherUser.sidebar_animation && (
                    <div
                      className="absolute inset-0 rounded pointer-events-none transition-opacity duration-150"
                      style={{ opacity: (hoveredDmId === dm.id || dmId === dm.id) ? 1 : 0 }}
                    >
                      {dm.otherUser.sidebar_animation === 'snow'
                        ? <DmSnowOverlay />
                        : dm.otherUser.sidebar_animation === 'bloodmoon'
                          ? <DmBloodmoonOverlay />
                          : dm.otherUser.sidebar_animation === 'bluemoon'
                            ? <DmBluemoonOverlay />
                            : dm.otherUser.sidebar_animation === 'solar'
                              ? <DmSolarOverlay />
                              : <DmShootingStarsOverlay />}
                    </div>
                  )}
                  <div className="relative z-10 flex items-center gap-2 w-full min-w-0">
                    <div className="relative w-8 h-8 shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-xs font-bold select-none">
                        {dm.otherUser?.avatar_url
                          ? <img src={dm.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (dm.otherUser?.display_name || dm.otherUser?.username)?.charAt(0).toUpperCase()}
                      </div>
                      {(unreadCounts[dm.id] ?? 0) > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none">
                          {unreadCounts[dm.id] > 99 ? '99+' : unreadCounts[dm.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{(dm.otherUser?.id && nicknames.get(dm.otherUser.id)) ?? displayName(dm.otherUser)}</p>
                      {dm.lastMsg && (
                        <p className="text-xs text-[#6d6f78] truncate">{dm.lastMsg}</p>
                      )}
                    </div>
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
                      <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center">
                        {g.icon_url
                          ? <img src={g.icon_url} alt="" className="w-full h-full object-cover" />
                          : <Users className="w-4 h-4 text-white" />}
                      </div>
                      {(unreadCounts[g.id] ?? 0) > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 bg-[#ed4245] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-[3px] leading-none pointer-events-none">
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
