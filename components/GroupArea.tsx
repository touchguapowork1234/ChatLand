'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Pencil, Send, UserPlus, CornerUpLeft, X, Paperclip, Upload, Trash2, Loader2, Phone, Mic, MicOff, PhoneOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { GroupChat, GroupMember, GroupMessage, GroupCall, GroupCallParticipant, Profile } from '@/lib/types'
import { displayName } from '@/lib/types'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'
import AddGroupMemberModal from './AddGroupMemberModal'
import FileAttachment from './FileAttachment'
import { useGroupCall } from './GroupCallProvider'

interface Props {
  group: GroupChat
  initialMessages: GroupMessage[]
  initialMembers: GroupMember[]
  currentUserId: string
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function GroupArea({ group: initialGroup, initialMessages, initialMembers, currentUserId }: Props) {
  const supabase = createClient()
  const { openProfile } = useProfileCard()
  const { gcGroupId, gcMuted, gcPeerMuted, startGroupCall, joinGroupCall, leaveGroupCall, toggleGcMute } = useGroupCall()
  const [group, setGroup]       = useState(initialGroup)
  const [messages, setMessages] = useState<GroupMessage[]>(initialMessages)
  const [members, setMembers]   = useState<GroupMember[]>(initialMembers)
  const [activeCall, setActiveCall]           = useState<GroupCall | null>(null)
  const [callParticipants, setCallParticipants] = useState<GroupCallParticipant[]>([])
  const [content, setContent]   = useState('')
  const [sending, setSending]   = useState(false)
  const [editing, setEditing]       = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo]   = useState<GroupMessage | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [fileError, setFileError]     = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [ctxMenu, setCtxMenu]   = useState<{ x: number; y: number; userId: string } | null>(null)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [friendIds, setFriendIds]   = useState<Set<string>>(new Set())
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter  = useRef(0)

  const startEdit = (msg: GroupMessage) => { setEditing(msg.id); setEditContent(msg.content) }
  const cancelEdit = () => setEditing(null)
  const saveEdit = async (msgId: string) => {
    const trimmed = editContent.trim()
    if (!trimmed) { cancelEdit(); return }
    const now = new Date().toISOString()
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed, updated_at: now } : m))
    cancelEdit()
    await supabase.from('group_messages')
      .update({ content: trimmed, updated_at: now })
      .eq('id', msgId).eq('sender_id', currentUserId)
  }

  const startReply = (msg: GroupMessage) => { setReplyTo(msg); inputRef.current?.focus() }
  const cancelReply = () => setReplyTo(null)

  const pickFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 20 MB limit')
      setTimeout(() => setFileError(''), 4000)
      return
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
      setFileError('Only images and audio files are supported')
      setTimeout(() => setFileError(''), 4000)
      return
    }
    setPendingFile(file)
    setFileError('')
  }

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setIsDragging(true) }
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault() }
  const handleDragLeave = () => { dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) pickFile(file)
  }

  const uploadFile = async (file: File) => {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
    const path = `${currentUserId}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`
    const { error } = await supabase.storage.from('chat-files').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, type: file.type }
  }

  const deleteMsg = async (msg: GroupMessage) => {
    if (msg.file_url) {
      try {
        const path = new URL(msg.file_url).pathname.split('/chat-files/')[1]
        if (path) await supabase.storage.from('chat-files').remove([decodeURIComponent(path)])
      } catch {}
    }
    await supabase.from('group_messages').delete().eq('id', msg.id).eq('sender_id', currentUserId)
    setMessages(prev => prev.filter(m => m.id !== msg.id))
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const latestTsRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last) latestTsRef.current = last.created_at
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles(*)')
      .eq('group_id', group.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as GroupMessage[])
  }

  const fetchNewMessages = async () => {
    const since = latestTsRef.current
    if (!since) return
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles(*)')
      .eq('group_id', group.id)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
    if (data?.length) {
      setMessages(prev => {
        const incoming = (data as GroupMessage[]).filter(m => !prev.find(p => p.id === m.id))
        return incoming.length ? [...prev, ...incoming] : prev
      })
    }
  }

  // Realtime new messages
  useEffect(() => {
    let firstSubscribe = true

    const ch = supabase.channel(`group_${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${group.id}`,
      }, async payload => {
        const msg = payload.new as GroupMessage
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).single()
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, { ...msg, profiles: prof as Profile }])
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          if (firstSubscribe) { firstSubscribe = false; return }
          fetchMessages()
        }
      })

    return () => { supabase.removeChannel(ch) }
  }, [group.id])

  // Polling fallback — catches any messages realtime missed
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNewMessages()
    }, 3000)
    return () => clearInterval(interval)
  }, [group.id])

  // Refetch when tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNewMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [group.id])

  // Realtime new members
  useEffect(() => {
    const ch = supabase.channel(`group_members_${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_members',
        filter: `group_id=eq.${group.id}`,
      }, async payload => {
        const mem = payload.new as GroupMember
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', mem.user_id).single()
        setMembers(prev => {
          if (prev.find(m => m.id === mem.id)) return prev
          return [...prev, { ...mem, profiles: profile as Profile }]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [group.id])

  // Realtime group metadata (name / icon changes)
  useEffect(() => {
    const ch = supabase.channel(`group_meta_${group.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_chats',
        filter: `id=eq.${group.id}`,
      }, payload => {
        setGroup(payload.new as GroupChat)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [group.id])

  // Load active call on mount
  useEffect(() => {
    supabase
      .from('group_calls')
      .select('*')
      .eq('group_id', group.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveCall(data as GroupCall)
          supabase
            .from('group_call_participants')
            .select('*, profiles(*)')
            .eq('call_id', data.id)
            .then(({ data: parts }) => setCallParticipants((parts ?? []) as GroupCallParticipant[]))
        }
      })
  }, [group.id])

  // Realtime: group_calls INSERT/UPDATE for this group
  useEffect(() => {
    const ch = supabase
      .channel(`group_calls_${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_calls',
        filter: `group_id=eq.${group.id}`,
      }, (payload) => {
        const call = payload.new as GroupCall
        if (call.status === 'active') {
          setActiveCall(call)
          setCallParticipants([])
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_calls',
        filter: `group_id=eq.${group.id}`,
      }, (payload) => {
        const call = payload.new as GroupCall
        if (call.status === 'ended') {
          setActiveCall(null)
          setCallParticipants([])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [group.id])

  // Realtime: group_call_participants INSERT/DELETE for active call
  useEffect(() => {
    if (!activeCall) return
    const ch = supabase
      .channel(`group_call_participants_${activeCall.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_call_participants',
        filter: `call_id=eq.${activeCall.id}`,
      }, async (payload) => {
        const part = payload.new as GroupCallParticipant
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', part.user_id).single()
        setCallParticipants(prev => {
          if (prev.find(p => p.id === part.id)) return prev
          return [...prev, { ...part, profiles: prof as Profile }]
        })
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'group_call_participants',
        filter: `call_id=eq.${activeCall.id}`,
      }, (payload) => {
        const part = payload.old as GroupCallParticipant
        setCallParticipants(prev => prev.filter(p => p.id !== part.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeCall?.id])

  useEffect(() => {
    supabase.from('blocks').select('blocked_id').eq('blocker_id', currentUserId)
      .then(({ data }) => setBlockedIds(new Set((data ?? []).map((b: { blocked_id: string }) => b.blocked_id))))
    supabase.from('friend_requests').select('sender_id, receiver_id').eq('status', 'accepted')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .then(({ data }) => setFriendIds(new Set((data ?? []).map((r: { sender_id: string; receiver_id: string }) =>
        r.sender_id === currentUserId ? r.receiver_id : r.sender_id
      ))))
  }, [currentUserId])

  const blockGroupUser = async (userId: string) => {
    await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: userId })
    setBlockedIds(prev => new Set([...prev, userId]))
  }

  const unblockGroupUser = async (userId: string) => {
    await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', userId)
    setBlockedIds(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  const removeGroupFriend = async (userId: string) => {
    await supabase.rpc('remove_friend', { friend_user_id: userId })
    setFriendIds(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  const send = async () => {
    const trimmed = content.trim()
    if (!trimmed && !pendingFile || sending || uploading) return
    setSending(true)

    let fileFields: { file_url?: string; file_name?: string; file_type?: string } = {}
    if (pendingFile) {
      setUploading(true)
      const result = await uploadFile(pendingFile)
      setUploading(false)
      if (!result) {
        setFileError('Upload failed, please try again')
        setSending(false)
        return
      }
      fileFields = { file_url: result.url, file_name: result.name, file_type: result.type }
      setPendingFile(null)
    }

    setContent('')
    const reply = replyTo
    setReplyTo(null)

    const { data: newMsg } = await supabase.from('group_messages')
      .insert({
        group_id: group.id,
        sender_id: currentUserId,
        content: trimmed || '',
        ...(reply ? { reply_to_id: reply.id } : {}),
        ...fileFields,
      })
      .select('*, profiles(*)')
      .single()
    if (newMsg) setMessages(prev =>
      prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg as GroupMessage]
    )
    setSending(false)
  }

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d: string) => {
    const date = new Date(d)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const onCtx = (e: React.MouseEvent, userId: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, userId })
  }

  const kickMember = async (userId: string) => {
    const kicked = members.find(m => m.user_id === userId)
    const kickedName = kicked?.profiles?.display_name || kicked?.profiles?.username || 'Someone'
    const kicker = members.find(m => m.user_id === currentUserId)
    const kickerName = kicker?.profiles?.display_name || kicker?.profiles?.username || 'Someone'
    await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', userId)
    const { data: sysMsg } = await supabase.from('group_messages')
      .insert({ group_id: group.id, sender_id: currentUserId, content: `${kickerName} kicked ${kickedName} from the group`, type: 'system' })
      .select('*, profiles(*)')
      .single()
    if (sysMsg) setMessages(prev => prev.find(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg as GroupMessage])
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const hasTopBar = !!replyTo || !!pendingFile

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#5865f2]/20 border-2 border-dashed border-[#5865f2] rounded-lg flex items-center justify-center pointer-events-none m-2">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#5865f2] mx-auto mb-3" />
            <p className="text-[#dbdee1] font-semibold text-lg">Drop to share</p>
            <p className="text-[#949ba4] text-sm mt-1">Images and audio · max 20 MB</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'View Profile', onClick: () => openProfile(ctxMenu.userId) },
            ...(ctxMenu.userId !== currentUserId ? [
              ...(currentUserId === group.created_by
                ? [{ label: 'Kick from group', danger: true, onClick: () => kickMember(ctxMenu.userId) }]
                : []),
              ...(friendIds.has(ctxMenu.userId)
                ? [{ label: 'Remove Friend', danger: true, onClick: () => removeGroupFriend(ctxMenu.userId) }]
                : []),
              blockedIds.has(ctxMenu.userId)
                ? { label: 'Unblock', onClick: () => unblockGroupUser(ctxMenu.userId) }
                : { label: 'Block', danger: true, onClick: () => blockGroupUser(ctxMenu.userId) },
            ] : []),
          ]}
        />
      )}
      {showAddMember && (
        <AddGroupMemberModal
          groupId={group.id}
          currentUserId={currentUserId}
          currentMembers={members}
          onAdded={async (newMembers) => {
            setMembers(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              return [...prev, ...newMembers.filter(m => !existingIds.has(m.id))]
            })
            const adder = members.find(m => m.user_id === currentUserId)
            const adderName = adder?.profiles?.display_name || adder?.profiles?.username || 'Someone'
            for (const nm of newMembers) {
              const addedName = nm.profiles?.display_name || nm.profiles?.username || 'Someone'
              const { data: sysMsg } = await supabase.from('group_messages')
                .insert({ group_id: group.id, sender_id: currentUserId, content: `${adderName} added ${addedName} to the group`, type: 'system' })
                .select('*, profiles(*)')
                .single()
              if (sysMsg) setMessages(prev => prev.find(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg as GroupMessage])
            }
          }}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center shrink-0">
            {group.icon_url
              ? <img src={group.icon_url} alt="" className="w-full h-full object-cover" />
              : <Users className="w-3.5 h-3.5 text-white" />}
          </div>
          <h3 className="font-semibold text-[#dbdee1]">{group.name}</h3>
          <span className="text-xs text-[#949ba4]">{members.length} members</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (!activeCall) {
                startGroupCall(group.id, group.name)
              } else if (gcGroupId !== group.id) {
                joinGroupCall(activeCall.id, group.id, group.name)
              }
            }}
            disabled={!!(activeCall && gcGroupId === group.id)}
            title={!activeCall ? 'Start voice call' : gcGroupId === group.id ? 'In call (leave from overlay)' : 'Join voice call'}
            className={`p-1.5 rounded transition-colors ${
              activeCall && gcGroupId === group.id
                ? 'text-[#23a55a] bg-[#383a40] cursor-default'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]'
            }`}
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMembers(v => !v)}
            title="Members"
            className={`p-1.5 rounded transition-colors ${showMembers ? 'text-[#dbdee1] bg-[#383a40]' : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]'}`}
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeCall && (
        <div className="bg-[#1e1f22] border-b border-[#111214] shrink-0 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#23a55a] animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-[#23a55a] uppercase tracking-wide">Voice Call</span>
              {callParticipants.length > 0 && (
                <span className="text-xs text-[#949ba4]">
                  · {callParticipants.length} participant{callParticipants.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {gcGroupId === group.id && (
                <button onClick={toggleGcMute} title={gcMuted ? 'Unmute' : 'Mute'}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    gcMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
                  }`}>
                  {gcMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              )}
              {gcGroupId !== group.id ? (
                <button
                  onClick={() => joinGroupCall(activeCall.id, group.id, group.name)}
                  className="px-3 py-1 bg-[#23a55a] hover:bg-[#1e8f4e] text-white text-xs font-medium rounded-full transition-colors"
                >Join</button>
              ) : (
                <button
                  onClick={leaveGroupCall}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-full flex items-center gap-1 transition-colors"
                >
                  <PhoneOff className="w-3 h-3" />Leave
                </button>
              )}
            </div>
          </div>
          {callParticipants.length > 0 && (
            <div className="flex gap-5 flex-wrap">
              {callParticipants.map(p => {
                const isSelf = p.user_id === currentUserId
                const muted  = isSelf ? gcMuted : (gcPeerMuted[p.user_id] ?? false)
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1.5">
                    <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold bg-[#383a40] ring-2 ${
                      muted ? 'ring-red-500/70' : 'ring-[#23a55a]/70'
                    }`}>
                      {p.profiles?.avatar_url
                        ? <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (p.profiles?.display_name || p.profiles?.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-[#dbdee1] font-medium max-w-[52px] truncate text-center">
                      {isSelf ? 'You' : displayName(p.profiles)}
                    </span>
                    {muted && <MicOff className="w-3 h-3 text-red-400 -mt-0.5" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#5865f2] rounded-full overflow-hidden flex items-center justify-center mb-4">
                {group.icon_url
                  ? <img src={group.icon_url} alt="" className="w-full h-full object-cover" />
                  : <Users className="w-8 h-8 text-white" />}
              </div>
              <p className="text-2xl font-bold text-[#dbdee1] mb-1">Welcome to {group.name}!</p>
              <p className="text-[#949ba4] text-sm">This is the beginning of the group chat.</p>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {messages.map((msg, i) => {
            const prev = messages[i - 1]
            const newDay = !prev ||
              new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()

            if (msg.type === 'system') {
              return (
                <div key={msg.id}>
                  {newDay && (
                    <div className="flex items-center gap-4 my-4">
                      <div className="flex-1 h-px bg-[#3f4147]" />
                      <span className="text-xs font-semibold text-[#949ba4]">{fmtDate(msg.created_at)}</span>
                      <div className="flex-1 h-px bg-[#3f4147]" />
                    </div>
                  )}
                  <div className="flex items-center justify-center my-1">
                    <span className="text-xs text-[#6d6f78] italic px-3 py-0.5 rounded-full bg-[#2b2d31]">
                      {msg.content}
                    </span>
                  </div>
                </div>
              )
            }

            const grouped = !!prev && prev.type !== 'system' && prev.sender_id === msg.sender_id &&
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000 &&
              !msg.reply_to_id
            const isMe = msg.sender_id === currentUserId
            const repliedMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null

            return (
              <div key={msg.id}>
                {newDay && (
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-[#3f4147]" />
                    <span className="text-xs font-semibold text-[#949ba4]">{fmtDate(msg.created_at)}</span>
                    <div className="flex-1 h-px bg-[#3f4147]" />
                  </div>
                )}
                <div className={`flex items-start gap-4 px-2 py-0.5 rounded hover:bg-[#2e3035] group ${!grouped ? 'mt-4' : ''}`}>
                  {!grouped ? (
                    <div
                      onContextMenu={e => onCtx(e, msg.sender_id)}
                      className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0 mt-0.5 text-sm select-none cursor-pointer ${isMe ? 'bg-[#383a40]' : 'bg-[#383a40]'}`}>
                      {msg.profiles?.avatar_url
                        ? <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (msg.profiles?.display_name || msg.profiles?.username || '?').charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 transition-opacity">
                        {fmtTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {repliedMsg && (
                      <div className="flex items-center gap-2 mb-1 text-xs text-[#949ba4] cursor-default">
                        <div className="w-0.5 h-4 bg-[#4e5058] rounded-full shrink-0" />
                        <span className="font-semibold text-[#b5bac1] truncate max-w-[80px]">{displayName(repliedMsg.profiles)}</span>
                        <span className="truncate">{repliedMsg.content}</span>
                      </div>
                    )}
                    {!grouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-[#dbdee1] text-sm">{displayName(msg.profiles)}</span>
                        <span className="text-[11px] text-[#949ba4]">{fmtTime(msg.created_at)}</span>
                      </div>
                    )}
                    {editing === msg.id ? (
                      <div>
                        <textarea
                          value={editContent}
                          autoFocus
                          rows={1}
                          style={{ resize: 'none' }}
                          onChange={e => {
                            setEditContent(e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = e.target.scrollHeight + 'px'
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id) }
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          className="w-full bg-[#383a40] text-[#dbdee1] px-3 py-1.5 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm"
                        />
                        <p className="text-[10px] text-[#949ba4] mt-1">
                          <span className="text-[#dbdee1]">esc</span> to cancel ·{' '}
                          <span className="text-[#dbdee1]">enter</span> to save
                        </p>
                      </div>
                    ) : (
                      <>
                        {msg.content && (
                          <p className="text-[#dcddde] text-sm leading-relaxed break-words whitespace-pre-wrap">
                            {msg.content}
                            {msg.updated_at && (
                              <span className="text-[10px] text-[#949ba4] ml-1.5 whitespace-nowrap">(edited)</span>
                            )}
                          </p>
                        )}
                        {msg.file_url && msg.file_name && msg.file_type && (
                          <FileAttachment url={msg.file_url} name={msg.file_name} type={msg.file_type} />
                        )}
                      </>
                    )}
                  </div>
                  {editing !== msg.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-start mt-0.5">
                      <button onClick={() => startReply(msg)} title="Reply"
                        className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]">
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      {isMe && (
                        <>
                          <button onClick={() => startEdit(msg)} title="Edit"
                            className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMsg(msg)} title="Delete"
                            className="p-1 rounded text-[#949ba4] hover:text-red-400 hover:bg-[#383a40]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="w-52 bg-[#2b2d31] border-l border-[#1e1f22] flex flex-col shrink-0">
            <div className="px-4 pt-4 pb-2 flex items-center">
              <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide flex-1">Members — {members.length}</p>
              {members.length < 10 && (
                <button onClick={() => setShowAddMember(true)} title="Add members"
                  className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors">
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {members.map(m => (
                <div key={m.id}
                  onContextMenu={e => onCtx(e, m.user_id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                    {m.profiles?.avatar_url
                      ? <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (m.profiles?.display_name || m.profiles?.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#dbdee1] truncate">{displayName(m.profiles)}</p>
                    {group.created_by === m.user_id && (
                      <p className="text-[10px] text-[#f0b132]">Owner</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        {fileError && (
          <p className="text-red-400 text-xs mb-1 px-1">{fileError}</p>
        )}
        {hasTopBar && (
          <div className="bg-[#2e3035] rounded-t-lg overflow-hidden">
            {pendingFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#949ba4] border-b border-[#383a40] last:border-0">
                <span className="flex-1 truncate text-[#b5bac1] font-medium">{pendingFile.name}</span>
                <span className="shrink-0 text-[#6d6f78]">{(pendingFile.size / 1024 / 1024).toFixed(1)} MB</span>
                <button onClick={() => setPendingFile(null)} className="p-0.5 rounded hover:text-[#dbdee1]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {replyTo && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#949ba4]">
                <CornerUpLeft className="w-3 h-3 shrink-0" />
                <span>Replying to <span className="font-semibold text-[#b5bac1]">{displayName(replyTo.profiles)}</span></span>
                <span className="flex-1 truncate text-[#6d6f78]">{replyTo.content}</span>
                <button onClick={cancelReply} className="p-0.5 rounded hover:text-[#dbdee1]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className={`bg-[#383a40] flex items-end gap-2 px-4 py-2.5 ${hasTopBar ? 'rounded-b-lg' : 'rounded-lg'}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-0.5 shrink-0 mb-0.5"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={content}
            onChange={e => {
              setContent(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Message ${group.name}`}
            rows={1}
            style={{ resize: 'none' }}
            className="flex-1 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] text-sm outline-none max-h-32 overflow-y-auto leading-relaxed py-0.5"
          />
          <button
            onClick={send}
            disabled={(!content.trim() && !pendingFile) || sending || uploading}
            className="text-[#5865f2] hover:text-[#4752c4] disabled:text-[#4e5058] transition-colors p-0.5 shrink-0"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
