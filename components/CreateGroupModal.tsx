'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Users, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'

const MAX_MEMBERS = 10

interface Friend {
  profile: Profile
}

export default function CreateGroupModal({ currentUserId, onClose }: { currentUserId: string; onClose: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: accepted } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      setFriends(
        (accepted ?? []).map(r => ({
          profile: (r.sender_id === currentUserId ? r.receiver : r.sender) as unknown as Profile,
        }))
      )
    }
    load()
    nameRef.current?.focus()
  }, [currentUserId])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_MEMBERS - 1) {
          setError(`Max ${MAX_MEMBERS} members (including you)`)
          return prev
        }
        next.add(id)
      }
      setError('')
      return next
    })
  }

  const create = async () => {
    const name = groupName.trim()
    if (!name) { setError('Enter a group name'); return }
    if (selected.size === 0) { setError('Select at least one friend'); return }
    setCreating(true)

    const { data: group, error: gcErr } = await supabase
      .from('group_chats')
      .insert({ name, created_by: currentUserId })
      .select()
      .single()

    if (gcErr || !group) { setError('Failed to create group'); setCreating(false); return }

    const members = [currentUserId, ...Array.from(selected)].map(uid => ({
      group_id: group.id,
      user_id: uid,
    }))
    await supabase.from('group_members').insert(members)

    router.push(`/group/${group.id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#313338] rounded-lg w-full max-w-md mx-4 shadow-xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#dbdee1]">New Group Chat</h2>
            <p className="text-[#949ba4] text-sm mt-0.5">Up to {MAX_MEMBERS} members including you</p>
          </div>
          <button onClick={onClose} className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1 rounded hover:bg-[#383a40]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group name input */}
        <div className="px-6 pb-4 shrink-0">
          <label className="block text-xs font-semibold uppercase text-[#949ba4] tracking-wide mb-1.5">Group Name</label>
          <input
            ref={nameRef}
            value={groupName}
            onChange={e => { setGroupName(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') create() }}
            placeholder="e.g. Squad, Gaming Night…"
            className="w-full bg-[#1e1f22] text-[#dbdee1] text-sm px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] placeholder-[#4e5058]"
          />
        </div>

        {/* Friends list */}
        <div className="px-6 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide">Add Friends</label>
            <span className="text-xs text-[#949ba4]">{selected.size}/{MAX_MEMBERS - 1} selected</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {friends.length === 0 ? (
            <p className="text-sm text-[#4e5058] text-center py-6">No friends to add yet</p>
          ) : (
            friends.map(({ profile: p }) => {
              const isSelected = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors mb-0.5 ${
                    isSelected ? 'bg-[#5865f2]/20' : 'hover:bg-[#383a40]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (p.display_name || p.username).charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-[#dbdee1]">{displayName(p)}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-[#5865f2] border-[#5865f2]' : 'border-[#4e5058]'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e1f22] shrink-0">
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={creating || !groupName.trim() || selected.size === 0}
              className="flex-1 px-4 py-2 rounded-md text-sm font-semibold bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              {creating ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
