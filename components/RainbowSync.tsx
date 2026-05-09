'use client'

import { useEffect } from 'react'

export default function RainbowSync() {
  useEffect(() => {
    const DURATION = 3000
    document.documentElement.style.setProperty(
      '--rainbow-phase',
      `-${Date.now() % DURATION}ms`
    )
  }, [])

  return null
}
