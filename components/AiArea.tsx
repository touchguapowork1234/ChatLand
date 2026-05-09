'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Bot, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

type Message = { role: 'user' | 'assistant'; content: string }
type AiCharacter = { name: string; avatar_url: string | null }

export default function AiArea({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const [character, setCharacter] = useState<AiCharacter>({ name: 'Mako AI', avatar_url: null })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('ai_character').select('name, avatar_url').eq('id', 1).single()
      .then(({ data }) => { if (data) setCharacter(data as AiCharacter) })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message ?? data.error ?? 'Sorry, something went wrong.',
      }])
    } catch (err) {
      console.error('[AiArea]', err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }])
    }

    setLoading(false)
  }

  const Avatar = ({ isUser }: { isUser: boolean }) => (
    <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white ${isUser ? 'bg-[#5865f2]' : 'bg-[#383a40]'}`}>
      {isUser
        ? (profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : profile.username.charAt(0).toUpperCase())
        : (character.avatar_url
            ? <img src={character.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <Bot className="w-4 h-4 text-[#949ba4]" />)}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1f22] shadow-sm shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden shrink-0 flex items-center justify-center">
          {character.avatar_url
            ? <img src={character.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <Bot className="w-4 h-4 text-white" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#dbdee1]">{character.name}</p>
          <p className="text-xs text-[#949ba4]">AI Assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center">
              {character.avatar_url
                ? <img src={character.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                : <Bot className="w-8 h-8 text-white" />}
            </div>
            <div>
              <p className="text-[#dbdee1] font-semibold text-lg">{character.name}</p>
              <p className="text-[#949ba4] text-sm mt-1">Start a conversation!</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar isUser={msg.role === 'user'} />
              <div className={`max-w-[70%] rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-[#5865f2] text-white' : 'bg-[#383a40] text-[#dbdee1]'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <Avatar isUser={false} />
              <div className="bg-[#383a40] rounded-lg px-3 py-2.5">
                <Loader2 className="w-4 h-4 text-[#949ba4] animate-spin" />
              </div>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#383a40] rounded-lg px-4 py-2.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={`Message ${character.name}…`}
            className="flex-1 bg-transparent text-[#dbdee1] placeholder-[#4e5058] outline-none text-sm"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="text-[#949ba4] hover:text-[#dbdee1] disabled:text-[#4e5058] disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
