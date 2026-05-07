'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Pencil, Send, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { GroupChat, GroupMember, GroupMessage, Profile } from '@/lib/types'
import { displayName } from '@/lib/types'
import ContextMenu from './ContextMenu'
import { useProfileCard } from './ProfileCardProvider'
import AddGroupMemberModal from './AddGroupMemberModal'

interface Props {
  group: GroupChat
  initialMessages: GroupMessage[]
  initialMembers: GroupMember[]
  currentUserId: string
}

export default function GroupArea({ group, initialMessages, initialMembers, currentUserId }: Props) {
  const supabase = createClient()
  const { openProfile } = useProfileCard()
  const [messages, setMessages] = useState<GroupMessage[]>(initialMessages)
  const [members, setMembers]   = useState<GroupMember[]>(initialMembers)
  const [content, setContent]   = useState('')
  const [sending, setSending]   = useState(false)
  const [editing, setEditing]       = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [ctxMenu, setCtxMenu]   = useState<{ x: number; y: number; userId: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  // Realtime new messages
  useEffect(() => {
    const ch = supabase.channel(`group_${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${group.id}`,
      }, async payload => {
        const msg = payload.new as GroupMessage
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          supabase.from('profiles').select('*').eq('id', msg.sender_id).single().then(({ data: profile }) => {
            setMessages(p => p.find(m => m.id === msg.id) ? p : [...p, { ...msg, profiles: profile as Profile }])
          })
          return prev
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
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

  const send = async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return
    setSending(true)
    setContent('')
    const { data: newMsg } = await supabase.from('group_messages')
      .insert({ group_id: group.id, sender_id: currentUserId, content: trimmed })
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
    await supabase.from('group_messages').insert({
      group_id: group.id,
      sender_id: currentUserId,
      content: `${kickerName} kicked ${kickedName} from the group`,
      type: 'system',
    })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'View Profile', onClick: () => openProfile(ctxMenu.userId) },
            ...(currentUserId === group.created_by && ctxMenu.userId !== currentUserId
              ? [{ label: 'Kick from group', danger: true, onClick: () => kickMember(ctxMenu.userId) }]
              : []),
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
              await supabase.from('group_messages').insert({
                group_id: group.id,
                sender_id: currentUserId,
                content: `${adderName} added ${addedName} to the group`,
                type: 'system',
              })
            }
          }}
          onClose={() => setShowAddMember(false)}
        />
      )}
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#949ba4] shrink-0" />
          <h3 className="font-semibold text-[#dbdee1]">{group.name}</h3>
          <span className="text-xs text-[#949ba4]">{members.length} members</span>
        </div>
        <button
          onClick={() => setShowMembers(v => !v)}
          title="Members"
          className={`p-1.5 rounded transition-colors ${showMembers ? 'text-[#dbdee1] bg-[#383a40]' : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]'}`}
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#5865f2] rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-white" />
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

            // System messages (e.g. "user left the group")
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
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
            const isMe = msg.sender_id === currentUserId

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
                      className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0 mt-0.5 text-sm select-none cursor-pointer ${isMe ? 'bg-[#5865f2]' : 'bg-[#ed4245]'}`}>
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
                      <p className="text-[#dcddde] text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                        {msg.updated_at && (
                          <span className="text-[10px] text-[#949ba4] ml-1.5 whitespace-nowrap">(edited)</span>
                        )}
                      </p>
                    )}
                  </div>
                  {isMe && editing !== msg.id && (
                    <button
                      onClick={() => startEdit(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-0.5 p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                <button
                  onClick={() => setShowAddMember(true)}
                  title="Add members"
                  className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {members.map(m => (
                <div key={m.id}
                  onContextMenu={e => onCtx(e, m.user_id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
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
            placeholder={`Message ${group.name}`}
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
