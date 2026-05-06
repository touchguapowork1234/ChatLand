'use client'

import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp so menu never goes off-screen
  const clampedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth  - 172) : x
  const clampedY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - items.length * 36 - 16) : y

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: clampedX, top: clampedY, zIndex: 9999 }}
      className="bg-[#111214] border border-[#1e1f22] rounded-md shadow-xl py-1.5 min-w-[160px]"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className={`w-full text-left px-3 py-1.5 text-sm font-medium transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/20'
              : 'text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
