'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function UserPanel({ profile }: { profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <div className="h-[52px] bg-[#232428] flex items-center px-2 gap-2 shrink-0">
      <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-sm font-bold shrink-0">
        {profile?.username?.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#dbdee1] truncate">{profile?.username}</p>
        <p className="text-xs text-[#23a55a]">● Online</p>
      </div>
      <button
        onClick={handleSignOut}
        title="Sign out"
        className="text-[#949ba4] hover:text-[#dbdee1] transition-colors p-1 rounded"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  )
}
