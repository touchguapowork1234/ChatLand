'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'
import SettingsModal from './SettingsModal'

export default function UserPanel({ profile: initialProfile }: { profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [showSettings, setShowSettings] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <>
      <div className="h-[52px] flex items-center px-2 gap-2 shrink-0 border-t border-black/20">
        <div className="w-8 h-8 rounded-full bg-[#5865f2] overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : (profile?.display_name || profile?.username)?.charAt(0).toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#dbdee1] truncate">{displayName(profile)}</p>
          <p className="text-xs text-[#23a55a]">● Online</p>
        </div>
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
      </div>

      {showSettings && (
        <SettingsModal
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdated={updated => { setProfile(updated); setShowSettings(false) }}
        />
      )}
    </>
  )
}
