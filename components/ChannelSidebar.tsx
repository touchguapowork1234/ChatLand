'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Hash, Plus, Copy, Check, UserPlus, X } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Channel, Profile, Server, DirectMessage } from '@/lib/types'
import { displayName } from '@/lib/types'
import UserPanel from './UserPanel'

type DmEntry = DirectMessage & { otherUser: Profile; lastMsg?: string }

export default function ChannelSidebar({ profile }: { profile: Profile }) {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const serverId  = params?.serverId  as string | undefined
  const channelId = params?.channelId as string | undefined
  const dmId      = params?.dmId      as string | undefined

  const [server, setServer]     = useState<Server | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [dms, setDms]           = useState<DmEntry[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [copied, setCopied]     = useState(false)

  // Load hidden DM IDs from localStorage
  useEffect(() => {
    const key = `cl_hidden_dms_${profile.id}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) setHiddenIds(new Set(JSON.parse(stored)))
    } catch {}
  }, [profile.id])

  const saveHidden = (next: Set<string>) => {
    setHiddenIds(next)
    try { localStorage.setItem(`cl_hidden_dms_${profile.id}`, JSON.stringify([...next])) } catch {}
  }

  const hideDM = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const next = new Set(hiddenIds)
    next.add(id)
    saveHidden(next)
    if (dmId === id) router.push('/')
  }

  // Un-hide the DM you navigate into
  useEffect(() => {
    if (dmId && hiddenIds.has(dmId)) {
      const next = new Set(hiddenIds)
      next.delete(dmId)
      saveHidden(next)
    }
  }, [dmId])

  // Server mode
  useEffect(() => {
    if (!serverId) { setServer(null); setChannels([]); return }
    supabase.from('servers').select('*').eq('id', serverId).single()
      .then(({ data }) => setServer(data))
    supabase.from('channels').select('*').eq('server_id', serverId).order('created_at', { ascending: true })
      .then(({ data }) => setChannels(data ?? []))
  }, [serverId])

  // DM mode — refetch whenever dmId changes so new DMs appear immediately
  useEffect(() => {
    if (serverId) return
    const load = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
      if (!data) return

      const enriched = await Promise.all(data.map(async dm => {
        const otherId = dm.user1_id === profile.id ? dm.user2_id : dm.user1_id
        const [{ data: other }, { data: last }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).single(),
          supabase.from('dm_messages').select('content').eq('dm_id', dm.id)
            .order('created_at', { ascending: false }).limit(1).single(),
        ])
        return { ...dm, otherUser: other as Profile, lastMsg: last?.content }
      }))
      setDms(enriched)
    }
    load()
  }, [serverId, profile.id, dmId])

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

  // ── DM sidebar (no server selected) ──
  if (!serverId) {
    const visibleDMs = dms.filter(dm => !hiddenIds.has(dm.id))

    return (
      <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0">
        <div className="p-3 border-b border-[#1e1f22]">
          <button
            onClick={() => router.push('/friends')}
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1] transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            Friends
          </button>
        </div>

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Direct Messages</p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {visibleDMs.map(dm => (
            <div key={dm.id} className="group relative">
              <button
                onClick={() => router.push(`/dm/${dm.id}`)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2 py-2 rounded transition-colors pr-8',
                  dmId === dm.id
                    ? 'bg-[#404249] text-[#dbdee1]'
                    : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                  {dm.otherUser?.avatar_url
                    ? <img src={dm.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (dm.otherUser?.display_name || dm.otherUser?.username)?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{displayName(dm.otherUser)}</p>
                  {dm.lastMsg && (
                    <p className="text-xs text-[#6d6f78] truncate">{dm.lastMsg}</p>
                  )}
                </div>
              </button>
              {/* X to close DM */}
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
            <p className="text-xs text-[#4e5058] px-2 mt-2">Add friends and start chatting!</p>
          )}
        </div>

        <UserPanel profile={profile} />
      </div>
    )
  }

  // ── Channel sidebar (server selected) ──
  const isOwner = profile?.id === server?.owner_id

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0">
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
