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
