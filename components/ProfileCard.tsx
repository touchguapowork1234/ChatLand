'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName, userTag } from '@/lib/types'
import { ShootingStarsAnimation, SnowAnimation, BloodmoonAnimation, BluemoonAnimation, SolarAnimation } from './ProfileBgAnimation'
import AvatarWithDecoration from './AvatarWithDecoration'
import { ATTACHMENTS } from '@/lib/attachments'
import { useStatus, STATUS_META } from './StatusProvider'

type Tab = 'overview' | 'mutuals'

interface Props {
  userId: string
  currentUserId: string
  onClose: () => void
}

export default function ProfileCard({ userId, currentUserId, onClose }: Props) {
  const supabase = createClient()
  const { getStatus } = useStatus()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mutuals, setMutuals] = useState<Profile[]>([])
  const [tab, setTab]         = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  const wrapperRef                    = useRef<HTMLDivElement>(null)
  const [tilt, setTilt]               = useState({ x: 0, y: 0 })
  const [tiltActive, setTiltActive]   = useState(false)
  const [shine, setShine]             = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const viewerEnabled = document.documentElement.classList.contains('anim-profile-fade')
    const ownerEnabled  = profile?.profile_tilt_enabled === true
    if (!viewerEnabled && !ownerEnabled) return
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2)
    const dy = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2)
    setTilt({ x: -dy * 14, y: dx * 14 })
    setShine({
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    })
    setTiltActive(true)
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
    setTiltActive(false)
  }

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

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 profile-backdrop-animate"
      onMouseDown={onBackdrop}
    >
      {/* Background animation layer — behind everything */}
      {profile?.profile_bg_animation === 'shooting_stars' && <ShootingStarsAnimation opacity={profile.profile_bg_opacity ?? 1} />}
      {profile?.profile_bg_animation === 'snow' && <SnowAnimation opacity={profile.profile_bg_opacity ?? 1} />}
      {profile?.profile_bg_animation === 'bloodmoon' && <BloodmoonAnimation opacity={profile.profile_bg_opacity ?? 1} />}
      {profile?.profile_bg_animation === 'bluemoon' && <BluemoonAnimation opacity={profile.profile_bg_opacity ?? 1} />}
      {profile?.profile_bg_animation === 'solar' && <SolarAnimation opacity={profile.profile_bg_opacity ?? 1} />}
      {/* Perspective wrapper — captures mouse for tilt */}
      <div
        ref={wrapperRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="profile-card-animate relative"
        style={{ perspective: '1000px', perspectiveOrigin: '50% 50%' }}
      >
        {/* Profile attachment — outside overflow-hidden card so it can overlap freely */}
        {profile?.is_premium && profile.profile_attachment && (() => {
          const att = ATTACHMENTS.find(a => a.id === profile.profile_attachment)
          return att ? (
            <img
              src={att.src}
              alt={att.label}
              className="absolute pointer-events-none select-none z-30"
              style={{ top: -50, right: 36, height: 88 }}
            />
          ) : null
        })()}

        {/* Card — receives the tilt transform */}
        <div
          className="relative rounded-lg w-[420px] shadow-2xl overflow-hidden flex flex-col"
          style={{
            ...(loading ? { background: '#232428' } : cardBodyStyle),
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tiltActive ? 1.02 : 1})`,
            transition: tiltActive
              ? 'transform 0.08s ease-out, box-shadow 0.08s ease-out'
              : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: (() => {
              const glow = (profile?.profile_glow_enabled && profile.profile_glow_color)
                ? `0 0 32px 8px ${hexToRgba(profile.profile_glow_color, profile.profile_glow_opacity ?? 0.8)}`
                : null
              const shadow = tiltActive
                ? `${-tilt.y * 2}px ${tilt.x * 2}px 40px rgba(0,0,0,0.55), ${-tilt.y * 0.5}px ${tilt.x * 0.5}px 12px rgba(0,0,0,0.3)`
                : '0 20px 50px rgba(0,0,0,0.4)'
              return glow ? `${glow}, ${shadow}` : shadow
            })(),
            willChange: 'transform',
          }}
        >
          {/* Shine highlight that follows cursor */}
          <div
            className="absolute inset-0 pointer-events-none z-20 rounded-lg"
            style={{
              background: tiltActive
                ? `radial-gradient(ellipse at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.14) 0%, transparent 60%)`
                : 'none',
              transition: tiltActive ? 'none' : 'background 0.3s ease',
            }}
          />

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
            {loading ? (
              <div className="rounded-full bg-[#383a40]" style={{ width: 96, height: 96, boxShadow: '0 0 0 4px rgba(0,0,0,0.4)' }} />
            ) : (
              <div className="relative inline-block">
                <div style={{ boxShadow: '0 0 0 4px rgba(0,0,0,0.4)', borderRadius: '50%', display: 'inline-block' }}>
                  <AvatarWithDecoration
                    avatarUrl={profile?.avatar_url}
                    displayInitial={(profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()}
                    size={96}
                    decoration={profile?.profile_decoration}
                  />
                </div>
                {/* Status dot */}
                <span
                  className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-[#232428]"
                  style={{ background: STATUS_META[getStatus(userId)].color }}
                  title={STATUS_META[getStatus(userId)].label}
                />
              </div>
            )}
          </div>

          {/* Name block */}
          <div className="px-5 pt-3 pb-4 shrink-0">
            {loading ? (
              <div className="h-6 w-36 bg-[#383a40] rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xl font-bold text-[#dbdee1] leading-tight">{displayName(profile)}</p>
                  {profile?.is_premium && (
                    <div className="relative group/badge shrink-0">
                      <img
                        src="/ysu_premium.png"
                        alt="Yasu Premium"
                        className="h-5 w-auto"
                      />
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#111214] text-[#dbdee1] text-xs font-semibold rounded shadow-lg whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity duration-150">
                        Yasu Premium
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111214]" />
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#949ba4] mt-0.5">{userTag(profile)}</p>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className={`flex border-b px-5 shrink-0 ${cardColorActive ? 'border-white/20' : 'border-[#1e1f22]'}`}>
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
                      <div className="w-8 h-8 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
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
    </div>
  )
}
