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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mutuals, setMutuals] = useState<Profile[]>([])
  const [tab, setTab]         = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setTab('overview')

      const [{ data: prof }, { data: mutualRows }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_mutual_friends', { user_a: currentUserId, user_b: userId }),
      ])

      setProfile(prof)

      const mutualIds = (mutualRows ?? []).map((r: { friend_id: string }) => r.friend_id)
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

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const cardColorActive = profile?.card_enabled === true && !!(profile?.card_primary || profile?.card_secondary)
  const cardPrimary   = cardColorActive ? profile!.card_primary!  : '#5865f2'
  const cardSecondary = cardColorActive ? (profile!.card_secondary ?? profile!.card_primary!) : '#7983f5'

  const bannerStyle: React.CSSProperties = profile?.banner_url
    ? {}
    : { background: `linear-gradient(135deg, ${cardPrimary}, ${cardSecondary})` }

  const cardBodyStyle: React.CSSProperties = cardColorActive
    ? { background: `linear-gradient(160deg, ${cardPrimary}, ${cardSecondary})` }
    : { background: `linear-gradient(160deg, ${cardPrimary}28 0%, ${cardSecondary}10 40%, #232428 70%)` }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onBackdrop}
    >
      <div className="rounded-lg w-[420px] shadow-2xl overflow-hidden flex flex-col" style={loading ? { background: '#232428' } : cardBodyStyle}>
        {/* Banner */}
        <div className="h-28 relative shrink-0" style={bannerStyle}>
          {profile?.banner_url && (
            <img
              src={profile.banner_url}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-5 pb-0 relative shrink-0" style={{ marginTop: -48 }}>
          <div
            className="rounded-full border-4 border-transparent bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-3xl font-bold select-none"
            style={{ width: 96, height: 96, boxShadow: '0 0 0 4px rgba(0,0,0,0.4)' }}
          >
            {loading ? null : profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Name block */}
        <div className={`px-5 pt-3 pb-4 shrink-0 ${cardColorActive ? 'bg-black/20' : ''}`}>
          {loading ? (
            <div className="h-6 w-36 bg-[#383a40] rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xl font-bold text-[#dbdee1] leading-tight">{displayName(profile)}</p>
                {profile?.is_premium && (
                  <img
                    src="/ysu_premium.png"
                    alt="Yasu Premium"
                    title="Yasu Premium"
                    className="h-5 w-auto shrink-0"
                  />
                )}
              </div>
              <p className="text-sm text-[#949ba4] mt-0.5">{userTag(profile)}</p>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className={`flex border-b px-5 shrink-0 ${cardColorActive ? 'border-white/20 bg-black/20' : 'border-[#1e1f22]'}`}>
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
        <div className={`flex-1 overflow-y-auto max-h-[480px] p-5 ${cardColorActive ? 'bg-black/20' : ''}`}>
          {tab === 'overview' && (
            loading ? (
              <div className="space-y-2">
                <div className="h-3 w-20 bg-[#383a40] rounded animate-pulse" />
                <div className="h-3 w-full bg-[#383a40] rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-[#383a40] rounded animate-pulse" />
              </div>
            ) : (
              <div className="min-h-[180px]">
                <p className="text-xs font-semibold uppercase text-[#949ba4] tracking-wide mb-3">About Me</p>
                {profile?.bio
                  ? <p className="text-sm text-[#dbdee1] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                  : <p className="text-sm text-[#4e5058]">No bio yet.</p>
                }
              </div>
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
