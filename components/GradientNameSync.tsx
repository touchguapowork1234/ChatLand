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

    const start = () => { raf = requestAnimationFrame(tick) }
    const stop  = () => cancelAnimationFrame(raf)

    const onVisibility = () =>
      document.visibilityState === 'hidden' ? stop() : start()

    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
