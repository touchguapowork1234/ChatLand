'use client'

import { useEffect, useRef } from 'react'

function blendWithDark(hex: string, opacity: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const br = Math.round(r * opacity + 49 * (1 - opacity))
  const bg = Math.round(g * opacity + 51 * (1 - opacity))
  const bb = Math.round(b * opacity + 56 * (1 - opacity))
  return `rgb(${br},${bg},${bb})`
}

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const style = getComputedStyle(document.documentElement)
      const p = style.getPropertyValue('--theme-primary').trim()
      const s = style.getPropertyValue('--theme-secondary').trim()
      if (p) {
        const c1 = blendWithDark(p, 0.12)
        const c2 = blendWithDark(s || p, 0.12)
        el.style.background = `linear-gradient(135deg, ${c1}, ${c2})`
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
