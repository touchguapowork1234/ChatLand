'use client'

import { useEffect } from 'react'

const DURATION = 3000

export default function RainbowSync() {
  useEffect(() => {
    let raf: number
    const tick = () => {
      const phase = (Date.now() % DURATION) / DURATION
      document.documentElement.style.setProperty('--rb-pos', `${phase * 200}%`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return null
}
