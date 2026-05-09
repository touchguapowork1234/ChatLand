'use client'

import { useState } from 'react'

interface Props {
  isRainbow: boolean
  className: string
  children: React.ReactNode
}

export default function RainbowText({ isRainbow, className, children }: Props) {
  // Captured once on mount — never changes, so re-renders never restart the animation.
  // Math: any element with delay = -(Date.now() % duration) always shows frame
  // (T % duration), so all elements stay in sync regardless of when they mounted.
  const [delay] = useState(() => `-${Date.now() % 3000}ms`)

  return (
    <p
      className={`${className} ${isRainbow ? 'rainbow-text' : 'text-[#dcddde]'}`}
      style={isRainbow ? { animationDelay: delay } : undefined}
    >
      {children}
    </p>
  )
}
