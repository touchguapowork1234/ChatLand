'use client'

import { useEffect, useRef } from 'react'

export default function ThemedMain({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const style = getComputedStyle(document.documentElement)
      const p = style.getPropertyValue('--theme-primary').trim()
      const s = style.getPropertyValue('--theme-secondary').trim()
      if (p) el.style.background = `linear-gradient(135deg, ${p}, ${s || p})`
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
