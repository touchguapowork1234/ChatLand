'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { GroupMember, Profile } from '@/lib/types'
import { displayName } from '@/lib/types'

const MAX_MEMBERS = 10

interface Props {
  groupId: string
  currentUserId: string
  currentMembers: GroupMember[]
  onAdded: (newMembers: GroupMember[]) => void
  onClose: () => void
}

export default function AddGroupMemberModal({ groupId, currentUserId, currentMembers, onAdded, onClose }: Props) {
  const supabase = createClient()
  const [friends, setFriends] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const existingIds = new Set(currentMembers.map(m => m.user_id))
  const slots = MAX_MEMBERS - currentMembers.length

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      const eligible = (data ?? [])
        .map(r => (r.sender_id === currentUserId ? r.receiver : r.sender) as unknown as Profile)
        .filter(p => !existingIds.has(p.id))
      setFriends(eligible)
    }
    load()
  }, [currentUserId])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= slots) {
          setError(`Group is full (max ${MAX_MEMBERS} members)`)
          return prev
        }
        next.add(id)
      }
      setError('')
      return next
    })
  }

  const add = async () => {
    if (selected.size === 0) { setError('Select at least one friend'); return }
    setAdding(true)
    const rows = Array.from(selected).map(uid => ({ group_id: groupId, user_id: uid }))
    const { data, error: err } = await supabase
      .from('group_members')
      .insert(rows)
      .select('*, profiles(*)')
    if (err) { setError('Failed to add members'); setAdding(false); return }
    onAdded((data ?? []) as GroupMember[])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="bg-[#313338] rounded-lg w-full max-w-sm mx-4 shadow-xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#dbdee1]">Add Members</h2>
            <p className="text-xs text-[#949ba4] mt-0.5">
              {slots > 0 ? `${slots} slot${slots !== 1 ? 's' : ''} remaining` : 'Group is full'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {friends.length === 0 ? (
            <p className="text-sm text-[#4e5058] text-center py-8">
              {slots === 0 ? 'Group is full.' : 'No friends to add.'}
            </p>
          ) : (
            friends.map(p => {
              const sel = selected.has(p.id)
              return (
                <button key={p.id} onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors mb-0.5 ${sel ? 'bg-[#5865f2]/20' : 'hover:bg-[#383a40]'}`}>
                  <div className="w-9 h-9 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (p.display_name || p.username).charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-[#dbdee1]">{displayName(p)}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-[#5865f2] border-[#5865f2]' : 'border-[#4e5058]'}`}>
                    {sel && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1e1f22] shrink-0">
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors">
              Cancel
            </button>
            <button onClick={add} disabled={adding || selected.size === 0 || slots === 0}
              className="flex-1 px-4 py-2 rounded-md text-sm font-semibold bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors">
              {adding ? 'Adding…' : `Add${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
