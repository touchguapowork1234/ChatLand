'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCall } from '@/components/CallProvider'
import type { DmMessage, Profile } from '@/lib/types'
import { userTag } from '@/lib/types'

interface Props {
  dmId: string
  otherUser: Profile
  currentUserId: string
  initialMessages: DmMessage[]
}

export default function DMArea({ dmId, otherUser, currentUserId, initialMessages }: Props) {
  const supabase = createClient()
  const { startCall } = useCall()
  const [messages, setMessages] = useState<DmMessage[]>(initialMessages)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMessages(initialMessages) }, [dmId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

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

  const send = async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return
    setSending(true)
    setContent('')
    await supabase.from('dm_messages').insert({ dm_id: dmId, sender_id: currentUserId, content: trimmed })
    setSending(false)
  }

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-xs font-bold">
            {otherUser.username.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-[#dbdee1]">{userTag(otherUser)}</span>
        </div>
        <button
          onClick={() => startCall(otherUser.id, otherUser)}
          title="Start voice call"
          className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1.5 rounded hover:bg-[#383a40]"
        >
          <Phone className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold mb-4">
              {otherUser.username.charAt(0).toUpperCase()}
            </div>
            <p className="text-2xl font-bold text-[#dbdee1] mb-1">{userTag(otherUser)}</p>
            <p className="text-[#949ba4] text-sm">This is the beginning of your direct message history.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const grouped = prev && prev.sender_id === msg.sender_id &&
            new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
          const isMe = msg.sender_id === currentUserId

          return (
            <div key={msg.id} className={`flex items-start gap-4 px-2 py-0.5 rounded hover:bg-[#2e3035] group ${!grouped ? 'mt-4' : ''}`}>
              {!grouped ? (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 mt-0.5 text-sm ${isMe ? 'bg-[#5865f2]' : 'bg-[#ed4245]'}`}>
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
                    <span className="font-semibold text-[#dbdee1] text-sm">
                      {userTag(msg.profiles)}
                    </span>
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
