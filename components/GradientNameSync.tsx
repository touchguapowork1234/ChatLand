'use client'

import { useEffect } from 'react'

const DURATION = 4000

export default function GradientNameSync() {
  useEffect(() => {
    let raf: number
    const tick = () => {
      const phase = (Date.now() % DURATION) / DURATION
      document.documentElement.style.setProperty('--gn-pos-l', `${phase * 200}%`)
      document.documentElement.style.setProperty('--gn-pos-r', `${(1 - phase) * 200}%`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return null
}
