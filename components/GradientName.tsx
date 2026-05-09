'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'

interface Props {
  profile?: Profile | null
  className?: string
  context?: 'chat' | 'profile'
}

export default function GradientName({ profile, className, context }: Props) {
  // Captured once at mount — gives animationDelay that syncs all elements to the
  // same phase: frame shown = (T - mountTime + mountTime % 4000) % 4000 = T % 4000
  const [delay] = useState(() => `-${Date.now() % 4000}ms`)

  const name = displayName(profile)
  const hasGradient = !!(
    profile?.is_premium &&
    profile?.name_gradient_enabled &&
    profile?.name_gradient_primary &&
    profile?.name_gradient_secondary
  )

  if (!hasGradient) return <span className={className}>{name}</span>

  if (context === 'chat' && profile?.name_gradient_in_chat === false)
    return <span className={className}>{name}</span>
  if (context === 'profile' && profile?.name_gradient_in_profile === false)
    return <span className={className}>{name}</span>

  const moving = profile?.name_gradient_moving === true
  const dir = profile?.name_gradient_direction === 'right' ? 'right' : 'left'
  const p = profile!.name_gradient_primary!
  const s = profile!.name_gradient_secondary!

  const gradient = moving
    ? `linear-gradient(90deg, ${p}, ${s}, ${p})`
    : `linear-gradient(90deg, ${p}, ${s})`

  const extraClass = moving ? `gradient-name-moving gradient-name-dir-${dir}` : ''

  return (
    <span
      className={`${className ?? ''} ${extraClass}`.trim()}
      style={{
        background: gradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...(moving ? { animationDelay: delay } : {}),
      }}
    >
      {name}
    </span>
  )
}
