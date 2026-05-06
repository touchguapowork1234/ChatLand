'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { userTag } from '@/lib/types'

interface Props {
  profile: Profile
  onClose: () => void
  onUpdated: (updated: Profile) => void
}

export default function SettingsModal({ profile, onClose, onUpdated }: Props) {
  const supabase = createClient()
  const [tag, setTag] = useState(profile.tag)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const save = async () => {
    setError('')
    setSuccess(false)

    if (!/^\d{4}$/.test(tag)) {
      setError('Tag must be exactly 4 digits (e.g. 0042)')
      return
    }
    if (tag === profile.tag) {
      setError('That is already your tag.')
      return
    }

    setLoading(true)

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', profile.username)
      .eq('tag', tag)
      .single()

    if (taken) {
      setError(`${profile.username}#${tag} is already taken.`)
      setLoading(false)
      return
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ tag })
      .eq('id', profile.id)

    if (updateErr) {
      setError('Failed to update. Please try again.')
    } else {
      setSuccess(true)
      onUpdated({ ...profile, tag })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#313338] rounded-xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#dbdee1]">Settings</h2>
          <button onClick={onClose} className="text-[#949ba4] hover:text-[#dbdee1] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-[#b5bac1] mb-1">Your Tag</p>
          <p className="text-[#949ba4] text-sm mb-4">
            Current: <span className="text-[#dbdee1] font-mono">{userTag(profile)}</span>
          </p>

          <label className="block text-xs font-semibold uppercase text-[#b5bac1] mb-2">
            New Tag (4 digits)
          </label>
          <div className="flex gap-2 items-center">
            <span className="text-[#949ba4] font-semibold">{profile.username}#</span>
            <input
              type="text"
              value={tag}
              onChange={e => { setTag(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); setSuccess(false) }}
              placeholder="0001"
              maxLength={4}
              className="w-24 bg-[#1e1f22] text-[#dbdee1] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] font-mono text-center"
            />
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          {success && <p className="text-[#23a55a] text-sm mt-2">Tag updated to #{tag}!</p>}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-[#dbdee1] hover:underline text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={tag.length !== 4 || loading}
            className="flex-1 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
