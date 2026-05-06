'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, MessageSquare } from 'lucide-react'
import { clsx } from 'clsx'
import type { Server } from '@/lib/types'
import CreateServerModal from './CreateServerModal'
import JoinServerModal from './JoinServerModal'

interface Props {
  servers: Server[]
  userId: string
}

export default function ServerRail({ servers: initial, userId }: Props) {
  const params = useParams()
  const router = useRouter()
  const [servers, setServers] = useState(initial)
  const [showMenu, setShowMenu] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const activeId = params?.serverId as string | undefined

  const handleAdded = (server: Server) => {
    setServers(prev => [...prev, server])
    router.push(`/${server.id}`)
  }

  return (
    <>
      <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
        <button
          onClick={() => router.push('/')}
          title="Home"
          className={clsx(
            'w-12 h-12 transition-all duration-150 flex items-center justify-center text-white',
            'rounded-[50%] hover:rounded-[16px]',
            !activeId ? 'bg-[#5865f2] rounded-[16px]' : 'bg-[#313338] hover:bg-[#5865f2]'
          )}
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <div className="w-8 h-[2px] bg-[#35373c] rounded-full shrink-0" />

        {servers.map(server => (
          <button
            key={server.id}
            onClick={() => router.push(`/${server.id}`)}
            title={server.name}
            className={clsx(
              'w-12 h-12 transition-all duration-150 flex items-center justify-center font-bold text-lg text-white shrink-0',
              'rounded-[50%] hover:rounded-[16px]',
              activeId === server.id ? 'bg-[#5865f2] rounded-[16px]' : 'bg-[#313338] hover:bg-[#5865f2]'
            )}
          >
            {server.name.charAt(0).toUpperCase()}
          </button>
        ))}

        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            title="Add server"
            className="w-12 h-12 rounded-[50%] hover:rounded-[16px] transition-all duration-150 bg-[#313338] hover:bg-[#23a55a] flex items-center justify-center text-[#23a55a] hover:text-white"
          >
            <Plus className="w-6 h-6" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute left-full ml-3 top-0 bg-[#111214] border border-[#2e3035] rounded-lg shadow-xl p-1.5 z-50 w-44">
                <button
                  onClick={() => { setShowCreate(true); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white rounded-md transition-colors"
                >
                  Create Server
                </button>
                <button
                  onClick={() => { setShowJoin(true); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white rounded-md transition-colors"
                >
                  Join Server
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateServerModal userId={userId} onClose={() => setShowCreate(false)} onCreated={handleAdded} />
      )}
      {showJoin && (
        <JoinServerModal userId={userId} onClose={() => setShowJoin(false)} onJoined={handleAdded} />
      )}
    </>
  )
}
