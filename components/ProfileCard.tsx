'use client'

import { useEffect, useState } from 'react'
import { X, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName, userTag } from '@/lib/types'

type Tab = 'overview' | 'mutuals'

interface Props {
  userId: string
  currentUserId: string
  onClose: () => void
}

export default function ProfileCard({ userId, currentUserId, onClose }: Props) {
  const supabase = createClient()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [mutuals, setMutuals]   = useState<Profile[]>([])
  const [tab, setTab]           = useState<Tab>('overview')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setTab('overview')

      const [{ data: prof }, { data: myFriends }, { data: theirFriends }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('friend_requests').select('sender_id, receiver_id').eq('status', 'accepted')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`),
        supabase.from('friend_requests').select('sender_id, receiver_id').eq('status', 'accepted')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      ])

      setProfile(prof)

      // Compute mutual friend IDs
      const myIds = new Set(
        (myFriends ?? [])
          .map(r => r.sender_id === currentUserId ? r.receiver_id : r.sender_id)
          .filter(id => id !== userId)
      )
      const mutualIds = (theirFriends ?? [])
        .map(r => r.sender_id === userId ? r.receiver_id : r.sender_id)
        .filter(id => id !== currentUserId && myIds.has(id))

      if (mutualIds.length > 0) {
        const { data: mutProfiles } = await supabase.from('profiles').select('*').in('id', mutualIds)
        setMutuals(mutProfiles ?? [])
      } else {
        setMutuals([])
      }

      setLoading(false)
    }
    load()
  }, [userId, currentUserId])

  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onBackdrop}
    >
      <div className="bg-[#232428] rounded-lg w-80 shadow-2xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="h-20 bg-gradient-to-br from-[#5865f2] to-[#7983f5] relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-4 pb-0 relative shrink-0" style={{ marginTop: -36 }}>
          <div className="w-18 h-18 rounded-full border-4 border-[#232428] bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-2xl font-bold select-none"
            style={{ width: 72, height: 72 }}>
            {loading ? null : profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Name block */}
        <div className="px-4 pt-2 pb-3 shrink-0">
          {loading ? (
            <div className="h-5 w-32 bg-[#383a40] rounded animate-pulse" />
          ) : (
            <>
              <p className="text-lg font-bold text-[#dbdee1] leading-tight">{displayName(profile)}</p>
              <p className="text-sm text-[#949ba4]">{userTag(profile)}</p>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e1f22] px-4 shrink-0">
          {(['overview', 'mutuals'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 mr-4 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-[#dbdee1] text-[#dbdee1]'
                  : 'border-transparent text-[#949ba4] hover:text-[#dbdee1]'
              }`}
            >
              {t === 'mutuals' ? `Mutual Friends${mutuals.length ? ` ${mutuals.length}` : ''}` : 'Overview'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto max-h-64 p-4">
          {tab === 'overview' && (
            loading ? (
              <div className="space-y-2">
                <div className="h-3 w-20 bg-[#383a40] rounded animate-pulse" />
                <div className="h-3 w-full bg-[#383a40] rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-[#383a40] rounded animate-pulse" />
              </div>
            ) : profile?.bio ? (
              <>
                <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide mb-2">About Me</p>
                <p className="text-sm text-[#dbdee1] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </>
            ) : (
              <p className="text-sm text-[#4e5058] text-center mt-4">No bio yet.</p>
            )
          )}

          {tab === 'mutuals' && (
            loading ? (
              <div className="h-3 w-24 bg-[#383a40] rounded animate-pulse" />
            ) : mutuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <Users className="w-8 h-8 text-[#4e5058]" />
                <p className="text-sm text-[#4e5058]">No mutual friends</p>
              </div>
            ) : (
              <div className="space-y-1">
                {mutuals.map(m => (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (m.display_name || m.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#dbdee1] truncate">{displayName(m)}</p>
                      <p className="text-xs text-[#949ba4] truncate">{userTag(m)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
