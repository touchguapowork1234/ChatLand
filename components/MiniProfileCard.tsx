'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName, userTag } from '@/lib/types'
import AvatarWithDecoration from './AvatarWithDecoration'
import { useStatus, STATUS_META } from './StatusProvider'
import { useProfileCard } from './ProfileCardProvider'

interface Props {
  userId: string
  currentUserId: string
  anchor: { x: number; y: number }
  onClose: () => void
}

export default function MiniProfileCard({ userId, currentUserId, anchor, onClose }: Props) {
  const supabase = createClient()
  const { getStatus } = useStatus()
  const { openProfile } = useProfileCard()
  const [profile, setProfile] = useState<Profile | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(anchor)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data }) => { if (data) setProfile(data as Profile) })
  }, [userId])

  // Clamp position to viewport once card renders
  useEffect(() => {
    if (!ref.current) return
    const CARD_W = 280
    const cardH = ref.current.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = anchor.x + CARD_W + 16 > vw ? anchor.x - CARD_W - 8 : anchor.x
    const y = Math.min(anchor.y, vh - cardH - 16)
    setPos({ x, y })
  }, [anchor, profile])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const status = getStatus(userId)
  const meta = STATUS_META[status]

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[280px] bg-[#232428] rounded-xl shadow-2xl overflow-hidden border border-[#1e1f22] animate-in"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Banner / header */}
      <div className="relative h-14 bg-[#5865f2] shrink-0">
        {profile?.banner_url && (
          <img src={profile.banner_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        )}
        <div className="absolute -bottom-6 left-4">
          <div className="relative">
            <AvatarWithDecoration
              avatarUrl={profile?.avatar_url ?? null}
              displayInitial={(profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()}
              size={44}
              decoration={profile?.profile_decoration ?? null}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#232428]"
              style={{ background: meta?.color ?? '#4e5058' }}
            />
          </div>
        </div>
      </div>

      <div className="pt-9 px-4 pb-4 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[15px] font-bold text-[#dbdee1] leading-tight">{displayName(profile)}</p>
          {profile?.is_premium && (
            <img src="/ysu_premium.png" alt="Yasu Premium" className="h-4 w-auto shrink-0" />
          )}
        </div>
        <p className="text-xs text-[#949ba4]">{userTag(profile)}</p>
        {profile?.bio && (
          <p className="text-xs text-[#b5bac1] pt-1 line-clamp-2 leading-relaxed">{profile.bio}</p>
        )}
        {userId !== currentUserId && (
          <button
            onClick={() => { openProfile(userId); onClose() }}
            className="mt-3 w-full py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-md transition-colors"
          >
            View Full Profile
          </button>
        )}
      </div>
    </div>
  )
}
