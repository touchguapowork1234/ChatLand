'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, Profile } from '@/lib/types'
import { userTag } from '@/lib/types'
import MessageInput from './MessageInput'

type MessageWithProfile = Message & { profiles: Profile }

interface Props {
  channelId: string
  channelName: string
  initialMessages: MessageWithProfile[]
  currentUserId: string
}

export default function MessageArea({ channelId, channelName, initialMessages, currentUserId }: Props) {
  const [messages, setMessages] = useState<MessageWithProfile[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => { setMessages(initialMessages) }, [channelId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      }, async payload => {
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', payload.new.user_id).single()
        setMessages(prev => [...prev, { ...payload.new, profiles: profile } as MessageWithProfile])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const fmtDate = (d: string) => {
    const date = new Date(d)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 px-4 flex items-center gap-2 border-b border-[#1e1f22] shrink-0 shadow-sm">
        <span className="text-[#949ba4] font-bold text-xl">#</span>
        <h3 className="font-semibold text-[#dbdee1]">{channelName}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-[#404249] rounded-full flex items-center justify-center mb-4 text-3xl font-bold text-[#949ba4]">#</div>
            <p className="text-2xl font-bold text-[#dbdee1] mb-1">Welcome to #{channelName}!</p>
            <p className="text-[#949ba4]">This is the beginning of #{channelName}.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const grouped = prev && prev.user_id === msg.user_id &&
            new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
          const newDay = !prev ||
            new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()

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
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5 select-none">
                    {msg.profiles?.username?.charAt(0).toUpperCase()}
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
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput channelId={channelId} currentUserId={currentUserId} channelName={channelName} />
    </div>
  )
}
