'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCall } from '@/components/CallProvider'
import type { DmMessage, Profile, Call } from '@/lib/types'
import { userTag } from '@/lib/types'

interface Props {
  dmId: string
  otherUser: Profile
  currentUserId: string
  initialMessages: DmMessage[]
  initialCalls: Call[]
}

export default function DMArea({ dmId, otherUser, currentUserId, initialMessages, initialCalls }: Props) {
  const supabase = createClient()
  const { callState, callingUserId, incomingCallerId, isMuted, duration,
          startCall, endCall, acceptCall, declineCall, toggleMute } = useCall()

  const [messages, setMessages] = useState<DmMessage[]>(initialMessages)
  const [calls, setCalls]       = useState<Call[]>(initialCalls)
  const [content, setContent]   = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isCallingThis  = callState === 'calling'  && callingUserId  === otherUser.id
  const isRingingThis  = callState === 'ringing'  && incomingCallerId === otherUser.id
  const isActiveThis   = callState === 'active'   && (callingUserId === otherUser.id || incomingCallerId === otherUser.id)

  // Unified sorted timeline of messages + call events
  const timeline = useMemo(() => [
    ...messages.map(m => ({ type: 'message' as const, data: m, ts: new Date(m.created_at).getTime() })),
    ...calls.map(c => ({ type: 'call' as const, data: c, ts: new Date(c.created_at).getTime() })),
  ].sort((a, b) => a.ts - b.ts), [messages, calls])

  useEffect(() => { setMessages(initialMessages); setCalls(initialCalls) }, [dmId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [timeline.length])

  useEffect(() => {
    const ch = supabase.channel(`dm_${dmId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: `dm_id=eq.${dmId}`,
      }, async payload => {
        const msg = payload.new as DmMessage
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).single()
        setMessages(prev => [...prev, { ...msg, profiles: profile as Profile }])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dmId])

  // Realtime call upserts (INSERT when caller, UPDATE for status changes on both sides)
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
    if (!trimmed || sending) return
    setSending(true)
    setContent('')
    await supabase.from('dm_messages').insert({ dm_id: dmId, sender_id: currentUserId, content: trimmed })
    setSending(false)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-xs font-bold select-none">
            {otherUser.username.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-[#dbdee1]">{userTag(otherUser)}</span>
        </div>
        {callState === 'idle' && (
          <button onClick={() => startCall(otherUser.id, otherUser)} title="Start voice call"
            className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1.5 rounded hover:bg-[#383a40]">
            <Phone className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Call bar ── */}
      {isCallingThis && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a3a2a] border-b border-[#23a55a]/30 shrink-0">
          <div className="flex gap-1 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f0b132] animate-ping" />
          </div>
          <span className="text-[#f0b132] text-sm font-medium flex-1">
            Calling {userTag(otherUser)}…
          </span>
          <button onClick={endCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
            <PhoneOff className="w-3.5 h-3.5" /> End Call
          </button>
        </div>
      )}

      {isRingingThis && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a3a2a] border-b border-[#23a55a]/30 shrink-0">
          <Phone className="w-4 h-4 text-[#23a55a] animate-bounce shrink-0" />
          <span className="text-[#23a55a] text-sm font-medium flex-1">
            Incoming call from {userTag(otherUser)}
          </span>
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
          <span className="text-[#23a55a] text-sm font-medium flex-1">
            Voice Connected — {fmt(duration)}
          </span>
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

      {/* Timeline: messages + call events */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
        {timeline.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold mb-4 select-none">
              {otherUser.username.charAt(0).toUpperCase()}
            </div>
            <p className="text-2xl font-bold text-[#dbdee1] mb-1">{userTag(otherUser)}</p>
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
              ended:   { bg: 'bg-[#383a40]', fg: 'text-[#949ba4]', icon: <Phone className="w-4 h-4" />,    sub: `Ended${dur ? ` · ${dur}` : ''}` },
              active:  { bg: 'bg-[#23a55a]/20', fg: 'text-[#23a55a]', icon: <Phone className="w-4 h-4 animate-pulse" />, sub: 'Ongoing…' },
              ringing: { bg: 'bg-[#f0b132]/20', fg: 'text-[#f0b132]', icon: <Phone className="w-4 h-4" />, sub: isOutgoing ? 'Calling…' : 'Incoming call' },
              declined:{ bg: 'bg-red-500/20',   fg: 'text-red-400',   icon: <PhoneOff className="w-4 h-4" />, sub: isOutgoing ? 'Declined' : 'You declined' },
              missed:  { bg: 'bg-red-500/20',   fg: 'text-red-400',   icon: <Phone className="w-4 h-4" />,    sub: 'Missed call' },
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

          // Message
          const msg = item.data as DmMessage
          const prevItem = timeline[i - 1]
          const prevMsg = prevItem?.type === 'message' ? prevItem.data as DmMessage : null
          const grouped = !!prevMsg && prevMsg.sender_id === msg.sender_id &&
            item.ts - prevItem.ts < 5 * 60_000
          const isMe = msg.sender_id === currentUserId

          return (
            <div key={msg.id}
              className={`flex items-start gap-4 px-2 py-0.5 rounded hover:bg-[#2e3035] group ${!grouped ? 'mt-4' : ''}`}>
              {!grouped ? (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 mt-0.5 text-sm select-none ${isMe ? 'bg-[#5865f2]' : 'bg-[#ed4245]'}`}>
                  {(msg.profiles?.username ?? '?').charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-10 shrink-0 flex items-center justify-center">
                  <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 transition-opacity">
                    {fmtTime(msg.created_at)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {!grouped && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-[#dbdee1] text-sm">{userTag(msg.profiles)}</span>
                    <span className="text-[11px] text-[#949ba4]">{fmtTime(msg.created_at)}</span>
                  </div>
                )}
                <p className="text-[#dcddde] text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        <div className="bg-[#383a40] rounded-lg flex items-end gap-2 px-4 py-2.5">
          <textarea
            value={content}
            onChange={e => {
              setContent(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Message ${userTag(otherUser)}`}
            rows={1}
            style={{ resize: 'none' }}
            className="flex-1 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] text-sm outline-none max-h-32 overflow-y-auto leading-relaxed py-0.5"
          />
          <button onClick={send} disabled={!content.trim() || sending}
            className="text-[#5865f2] hover:text-[#4752c4] disabled:text-[#4e5058] transition-colors p-0.5 shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
