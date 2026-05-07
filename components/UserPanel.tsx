'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'
import SettingsModal from './SettingsModal'
import { useStatus, STATUS_META, type OnlineStatus } from './StatusProvider'

const STATUS_ORDER: OnlineStatus[] = ['online', 'idle', 'dnd', 'offline']

export default function UserPanel({ profile: initialProfile }: { profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [showSettings, setShowSettings] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { status, setStatus } = useStatus()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    if (showStatusMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusMenu])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  const meta = STATUS_META[status]

  return (
    <>
      <div className="h-[52px] flex items-center px-2 gap-2 shrink-0 border-t border-black/20 relative">
        {/* Clickable card area */}
        <button
          className="flex items-center gap-2 flex-1 min-w-0 rounded px-1 py-1 hover:bg-[#35373c] transition-colors text-left"
          onClick={() => setShowStatusMenu(v => !v)}
        >
          <div className="relative w-8 h-8 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white text-sm font-bold select-none">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile?.display_name || profile?.username)?.charAt(0).toUpperCase()
              }
            </div>
            {/* Status dot */}
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1e1f22]"
              style={{ background: meta.color }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#dbdee1] truncate">{displayName(profile)}</p>
            <p className="text-xs" style={{ color: meta.color }}>● {meta.label}</p>
          </div>
        </button>

        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1 rounded"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1 rounded"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Status picker popup */}
        {showStatusMenu && (
          <div
            ref={menuRef}
            className="absolute bottom-[56px] left-2 w-52 bg-[#111214] rounded-lg shadow-xl border border-[#2e3035] py-1.5 z-50"
          >
            <p className="text-[10px] font-semibold text-[#949ba4] uppercase px-3 pb-1">Set Status</p>
            {STATUS_ORDER.map(s => {
              const m = STATUS_META[s]
              return (
                <button
                  key={s}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2e3035] transition-colors ${status === s ? 'bg-[#2e3035]' : ''}`}
                  onClick={() => { setStatus(s); setShowStatusMenu(false) }}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="text-sm text-[#dbdee1]">{m.label}</span>
                  {status === s && <span className="ml-auto text-[#5865f2] text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdated={updated => setProfile(updated)}
        />
      )}
    </>
  )
}
