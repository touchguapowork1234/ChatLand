'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Send, Pencil, CornerUpLeft, X, Paperclip, Upload, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCall } from '@/components/CallProvider'
import type { DmMessage, Profile, Call } from '@/lib/types'
import { displayName } from '@/lib/types'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'
import FileAttachment from './FileAttachment'

interface Props {
  dmId: string
  otherUser: Profile
  currentUserId: string
  initialMessages: DmMessage[]
  initialCalls: Call[]
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function DMArea({ dmId, otherUser, currentUserId, initialMessages, initialCalls }: Props) {
  const supabase = createClient()
  const { callState, callingUserId, incomingCallerId, isMuted, duration,
          startCall, endCall, acceptCall, declineCall, toggleMute } = useCall()
  const { openProfile } = useProfileCard()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; userId: string } | null>(null)

  const [messages, setMessages] = useState<DmMessage[]>(initialMessages)
  const [calls, setCalls]       = useState<Call[]>(initialCalls)
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false })
  const isBlocked = blockStatus.iBlockedThem || blockStatus.theyBlockedMe
  const [isFriend, setIsFriend] = useState(false)
  const [content, setContent]   = useState('')
  const [sending, setSending]   = useState(false)
  const [editing, setEditing]       = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo]   = useState<DmMessage | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [fileError, setFileError]     = useState('')
  const bottomRef     = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLTextAreaElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const dragCounter   = useRef(0)

  const startEdit = (msg: DmMessage) => { setEditing(msg.id); setEditContent(msg.content) }
  const cancelEdit = () => setEditing(null)
  const saveEdit = async (msgId: string) => {
    const trimmed = editContent.trim()
    if (!trimmed) { cancelEdit(); return }
    const now = new Date().toISOString()
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed, updated_at: now } : m))
    cancelEdit()
    await supabase.from('dm_messages')
      .update({ content: trimmed, updated_at: now })
      .eq('id', msgId).eq('sender_id', currentUserId)
  }

  const startReply = (msg: DmMessage) => { setReplyTo(msg); inputRef.current?.focus() }
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDragLeave = () => {
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
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

  const deleteMsg = async (msg: DmMessage) => {
    if (msg.file_url) {
      try {
        const path = new URL(msg.file_url).pathname.split('/chat-files/')[1]
        if (path) await supabase.storage.from('chat-files').remove([decodeURIComponent(path)])
      } catch {}
    }
    await supabase.from('dm_messages').delete().eq('id', msg.id).eq('sender_id', currentUserId)
    setMessages(prev => prev.filter(m => m.id !== msg.id))
  }

  const isCallingThis  = callState === 'calling'  && callingUserId  === otherUser.id
  const isRingingThis  = callState === 'ringing'  && incomingCallerId === otherUser.id
  const isActiveThis   = callState === 'active'   && (callingUserId === otherUser.id || incomingCallerId === otherUser.id)

  const timeline = useMemo(() => [
    ...messages.map(m => ({ type: 'message' as const, data: m, ts: new Date(m.created_at).getTime() })),
    ...calls.map(c => ({ type: 'call' as const, data: c, ts: new Date(c.created_at).getTime() })),
  ].sort((a, b) => a.ts - b.ts), [messages, calls])

  useEffect(() => { setMessages(initialMessages); setCalls(initialCalls) }, [dmId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [timeline.length])

  useEffect(() => {
    const load = async () => {
      const [{ data: blockData }, { data: friendData }] = await Promise.all([
        supabase.from('blocks').select('blocker_id, blocked_id')
          .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${otherUser.id}),and(blocker_id.eq.${otherUser.id},blocked_id.eq.${currentUserId})`),
        supabase.from('friend_requests').select('id').eq('status', 'accepted')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUserId})`),
      ])
      setBlockStatus({
        iBlockedThem: (blockData ?? []).some((b: { blocker_id: string }) => b.blocker_id === currentUserId),
        theyBlockedMe: (blockData ?? []).some((b: { blocker_id: string }) => b.blocker_id === otherUser.id),
      })
      setIsFriend((friendData ?? []).length > 0)
    }
    load()
  }, [dmId, currentUserId, otherUser.id])

  const blockOtherUser = async () => {
    await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: otherUser.id })
    setBlockStatus(s => ({ ...s, iBlockedThem: true }))
  }

  const unblockOtherUser = async () => {
    await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', otherUser.id)
    setBlockStatus(s => ({ ...s, iBlockedThem: false }))
  }

  const removeFriend = async () => {
    await supabase.rpc('remove_friend', { friend_user_id: otherUser.id })
    setIsFriend(false)
  }

  // Ref tracking the created_at of the newest message we have, for incremental polls
  const latestTsRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last && !last.failed) latestTsRef.current = last.created_at
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('dm_messages')
      .select('*, profiles(*)')
      .eq('dm_id', dmId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as DmMessage[])
  }

  const fetchNewMessages = async () => {
    const since = latestTsRef.current
    if (!since) return
    const { data } = await supabase
      .from('dm_messages')
      .select('*, profiles(*)')
      .eq('dm_id', dmId)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
    if (data?.length) {
      setMessages(prev => {
        const incoming = (data as DmMessage[]).filter(m => !prev.find(p => p.id === m.id))
        return incoming.length ? [...prev, ...incoming] : prev
      })
    }
  }

  useEffect(() => {
    let firstSubscribe = true

    const ch = supabase.channel(`dm_${dmId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: `dm_id=eq.${dmId}`,
      }, async payload => {
        const msg = payload.new as DmMessage
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
  }, [dmId])

  // Polling fallback — catches any messages realtime missed
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNewMessages()
    }, 3000)
    return () => clearInterval(interval)
  }, [dmId])

  // Refetch when tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNewMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [dmId])

  useEffect(() => {
    const upsert = (raw: unknown) => {
      const call = raw as Call
      const relevant =
        (call.caller_id === currentUserId && call.receiver_id === otherUser.id) ||
        (call.caller_id === otherUser.id && call.receiver_id === currentUserId)
      if (!relevant) return
      setCalls(prev => {
        if (prev.find(c => c.id === call.id))
          return prev.map(c => c.id === call.id ? call : c)
        return [...prev, call].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      })
    }

    const ch1 = supabase.channel(`calls_caller_${currentUserId}_${otherUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `caller_id=eq.${currentUserId}` }, p => upsert(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${currentUserId}` }, p => upsert(p.new))
      .subscribe()

    const ch2 = supabase.channel(`calls_receiver_${currentUserId}_${otherUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${currentUserId}` }, p => upsert(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `receiver_id=eq.${currentUserId}` }, p => upsert(p.new))
      .subscribe()

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [currentUserId, otherUser.id])

  const send = async () => {
    const trimmed = content.trim()
    if (!trimmed && !pendingFile || sending || uploading) return

    if (isBlocked) {
      if (trimmed) {
        setMessages(prev => [...prev, {
          id: `failed_${Date.now()}`,
          dm_id: dmId,
          sender_id: currentUserId,
          content: trimmed,
          created_at: new Date().toISOString(),
          updated_at: null,
          reply_to_id: null,
          file_url: null,
          file_name: null,
          file_type: null,
          failed: true,
        }])
      }
      setContent('')
      setPendingFile(null)
      setReplyTo(null)
      return
    }

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

    const { data: newMsg } = await supabase.from('dm_messages')
      .insert({
        dm_id: dmId,
        sender_id: currentUserId,
        content: trimmed || '',
        ...(reply ? { reply_to_id: reply.id } : {}),
        ...fileFields,
      })
      .select('*, profiles(*)')
      .single()
    if (newMsg) setMessages(prev =>
      prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg as DmMessage]
    )
    setSending(false)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const onCtx = (e: React.MouseEvent, userId: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, userId })
  }

  const hasTopBar = !!replyTo || !!pendingFile

  return (
    <div
      className="flex flex-col h-full relative"
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
              ...(isFriend ? [{ label: 'Remove Friend', danger: true, onClick: removeFriend }] : []),
              blockStatus.iBlockedThem
                ? { label: 'Unblock', onClick: unblockOtherUser }
                : { label: 'Block', danger: true, onClick: blockOtherUser },
            ] : []),
          ]}
        />
      )}

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0 shadow-sm">
        <div className="flex items-center gap-2" onContextMenu={e => onCtx(e, otherUser.id)}>
          <div className="w-7 h-7 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-xs font-bold select-none cursor-pointer">
            {otherUser.avatar_url
              ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              : (otherUser.display_name || otherUser.username).charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-[#dbdee1]">{displayName(otherUser)}</span>
        </div>
        {callState === 'idle' && (
          <button onClick={() => startCall(otherUser.id, otherUser)} title="Start voice call"
            className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1.5 rounded hover:bg-[#383a40]">
            <Phone className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Call bars */}
      {isCallingThis && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a3a2a] border-b border-[#23a55a]/30 shrink-0">
          <div className="flex gap-1 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f0b132] animate-ping" />
          </div>
          <span className="text-[#f0b132] text-sm font-medium flex-1">Calling {displayName(otherUser)}…</span>
          <button onClick={endCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
            <PhoneOff className="w-3.5 h-3.5" /> End Call
          </button>
        </div>
      )}
      {isRingingThis && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a3a2a] border-b border-[#23a55a]/30 shrink-0">
          <Phone className="w-4 h-4 text-[#23a55a] animate-bounce shrink-0" />
          <span className="text-[#23a55a] text-sm font-medium flex-1">Incoming call from {displayName(otherUser)}</span>
          <button onClick={acceptCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#23a55a] hover:bg-[#1e8f4e] text-white text-xs font-semibold transition-colors">
            <Phone className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={declineCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
            <PhoneOff className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}
      {isActiveThis && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a3a2a] border-b border-[#23a55a]/30 shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#23a55a] animate-pulse shrink-0" />
          <span className="text-[#23a55a] text-sm font-medium flex-1">Voice Connected — {fmt(duration)}</span>
          <button onClick={toggleMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
            }`}>
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={endCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
            <PhoneOff className="w-3.5 h-3.5" /> End Call
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
        {timeline.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-2xl font-bold mb-4 select-none">
              {otherUser.avatar_url
                ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                : (otherUser.display_name || otherUser.username).charAt(0).toUpperCase()}
            </div>
            <p className="text-2xl font-bold text-[#dbdee1] mb-1">{displayName(otherUser)}</p>
            <p className="text-[#949ba4] text-sm">This is the beginning of your direct message history.</p>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {timeline.map((item, i) => {
          if (item.type === 'call') {
            const call = item.data
            const isOutgoing = call.caller_id === currentUserId
            const dur = call.ended_at
              ? (() => {
                  const s = Math.round((new Date(call.ended_at).getTime() - new Date(call.created_at).getTime()) / 1000)
                  const m = Math.floor(s / 60)
                  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
                })()
              : null

            const cfg = {
              ended:   { bg: 'bg-[#383a40]',      fg: 'text-[#949ba4]', icon: <Phone className="w-4 h-4" />,                   sub: `Ended${dur ? ` · ${dur}` : ''}` },
              active:  { bg: 'bg-[#23a55a]/20',   fg: 'text-[#23a55a]', icon: <Phone className="w-4 h-4 animate-pulse" />,     sub: 'Ongoing…' },
              ringing: { bg: 'bg-[#f0b132]/20',   fg: 'text-[#f0b132]', icon: <Phone className="w-4 h-4" />,                   sub: isOutgoing ? 'Calling…' : 'Incoming call' },
              declined:{ bg: 'bg-red-500/20',     fg: 'text-red-400',   icon: <PhoneOff className="w-4 h-4" />,               sub: isOutgoing ? 'Declined' : 'You declined' },
              missed:  { bg: 'bg-red-500/20',     fg: 'text-red-400',   icon: <Phone className="w-4 h-4" />,                   sub: 'Missed call' },
            }[call.status]

            return (
              <div key={call.id} className="flex items-center gap-3 px-2 py-2 mt-3 rounded hover:bg-[#2e3035]">
                <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 ${cfg.fg}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#dbdee1]">{isOutgoing ? 'Outgoing' : 'Incoming'} Voice Call</p>
                  <p className={`text-xs ${cfg.fg}`}>{cfg.sub} · {fmtTime(call.created_at)}</p>
                </div>
              </div>
            )
          }

          const msg = item.data as DmMessage

          if (msg.failed) {
            return (
              <div key={msg.id} className="flex items-start gap-4 px-2 py-0.5 mt-2 opacity-80">
                <div className="w-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-400 text-sm break-words line-through">{msg.content}</p>
                  <span className="text-[10px] text-red-500/80">✗ Message not delivered</span>
                </div>
              </div>
            )
          }

          const prevItem = timeline[i - 1]
          const prevMsg = prevItem?.type === 'message' ? prevItem.data as DmMessage : null
          const grouped = !!prevMsg && prevMsg.sender_id === msg.sender_id &&
            item.ts - prevItem.ts < 5 * 60_000 && !msg.reply_to_id
          const isMe = msg.sender_id === currentUserId
          const repliedMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null

          return (
            <div key={msg.id}
              className={`flex items-start gap-4 px-2 py-0.5 rounded hover:bg-[#2e3035] group ${!grouped ? 'mt-4' : ''}`}>
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
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        {isBlocked && (
          <p className="text-red-400/80 text-xs mb-1.5 px-1">
            {blockStatus.iBlockedThem
              ? 'You have blocked this user — messages will not be delivered.'
              : 'You cannot send messages to this user.'}
          </p>
        )}
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
            placeholder={`Message ${displayName(otherUser)}`}
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
