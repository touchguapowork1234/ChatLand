'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Server } from '@/lib/types'

interface Props {
  userId: string
  onClose: () => void
  onCreated: (server: Server) => void
}

export default function CreateServerModal({ userId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('servers')
      .insert({ name: name.trim(), owner_id: userId })
      .select()
      .single()

    if (err) {
      setError('Failed to create server. Please try again.')
      setLoading(false)
      return
    }

    onCreated(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#313338] rounded-xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-bold text-[#dbdee1]">Create a Server</h2>
          <button onClick={onClose} className="text-[#949ba4] hover:text-[#dbdee1] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[#949ba4] text-sm mb-6">Your server is where you and your friends hang out.</p>

        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase text-[#b5bac1] mb-2">Server Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="My Awesome Server"
            autoFocus
            maxLength={100}
            className="w-full bg-[#1e1f22] text-[#dbdee1] px-3 py-2.5 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] placeholder-[#4e5058]"
          />
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-[#dbdee1] hover:underline text-sm">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm"
          >
            {loading ? 'Creating…' : 'Create Server'}
          </button>
        </div>
      </div>
    </div>
  )
}
