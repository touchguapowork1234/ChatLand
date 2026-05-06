'use client'

import { useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  channelId: string
  currentUserId: string
  channelName: string
}

export default function MessageInput({ channelId, currentUserId, channelName }: Props) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  const sendMessage = async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return

    setSending(true)
    setContent('')

    await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: currentUserId,
      content: trimmed,
    })

    setSending(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="px-4 pb-6 pt-2 shrink-0">
      <div className="bg-[#383a40] rounded-lg flex items-end gap-2 px-4 py-2.5">
        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          style={{ resize: 'none' }}
          className="flex-1 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] text-sm outline-none max-h-32 overflow-y-auto leading-relaxed py-0.5"
        />
        <button
          onClick={sendMessage}
          disabled={!content.trim() || sending}
          className="text-[#5865f2] hover:text-[#4752c4] disabled:text-[#4e5058] transition-colors p-0.5 shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-[#6d6f78] mt-1 px-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
