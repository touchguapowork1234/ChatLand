'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Hash, Plus, Copy, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Channel, Profile, Server } from '@/lib/types'
import UserPanel from './UserPanel'

export default function ChannelSidebar({ profile }: { profile: Profile }) {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const serverId = params?.serverId as string | undefined
  const channelId = params?.channelId as string | undefined

  const [server, setServer] = useState<Server | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!serverId) {
      setServer(null)
      setChannels([])
      return
    }

    supabase.from('servers').select('*').eq('id', serverId).single()
      .then(({ data }) => setServer(data))

    supabase.from('channels').select('*').eq('server_id', serverId).order('created_at', { ascending: true })
      .then(({ data }) => setChannels(data ?? []))
  }, [serverId])

  const createChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || !serverId) return

    const { data } = await supabase
      .from('channels')
      .insert({ server_id: serverId, name })
      .select()
      .single()

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

  if (!serverId) {
    return (
      <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0">
        <div className="h-12 px-4 flex items-center border-b border-[#1e1f22]">
          <span className="font-bold text-[#dbdee1]">ChatLand</span>
        </div>
        <div className="flex-1" />
        <UserPanel profile={profile} />
      </div>
    )
  }

  const isOwner = profile?.id === server?.owner_id

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm">
        <h2 className="font-bold text-[#dbdee1] truncate">{server?.name ?? '…'}</h2>
        {server?.invite_code && (
          <button
            onClick={copyInvite}
            title="Copy invite code"
            className="text-[#949ba4] hover:text-[#dbdee1] transition-colors ml-2 shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-[#23a55a]" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">
            Text Channels
          </span>
          {isOwner && (
            <button
              onClick={() => setShowNewChannel(v => !v)}
              className="text-[#949ba4] hover:text-[#dbdee1] transition-colors"
            >
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
              onKeyDown={e => {
                if (e.key === 'Enter') createChannel()
                if (e.key === 'Escape') setShowNewChannel(false)
              }}
              placeholder="new-channel"
              autoFocus
              className="w-full bg-[#1e1f22] text-[#dbdee1] text-sm px-2 py-1.5 rounded outline-none placeholder-[#949ba4]"
            />
          </div>
        )}

        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => router.push(`/${serverId}/${ch.id}`)}
            className={clsx(
              'w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors',
              channelId === ch.id
                ? 'bg-[#404249] text-[#dbdee1]'
                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
            )}
          >
            <Hash className="w-4 h-4 shrink-0" />
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </div>

      <UserPanel profile={profile} />
    </div>
  )
}
