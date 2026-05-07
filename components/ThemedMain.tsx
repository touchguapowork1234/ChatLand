'use client'

import { useEffect, useRef } from 'react'

function toRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return `rgba(0,0,0,0)`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const style = getComputedStyle(document.documentElement)
      const p = style.getPropertyValue('--theme-primary').trim()
      if (p) {
        el.style.backgroundImage = `linear-gradient(to right, ${toRgba(p, 0.18)} 0%, transparent 35%)`
      }
    }

    apply()

    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  return (
    <main ref={ref} className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#313338]">
      {children}
    </main>
  )
}
