import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'

interface Props {
  profile?: Profile | null
  className?: string
  context?: 'chat' | 'profile'
}

export default function GradientName({ profile, className, context }: Props) {
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

  return (
    <span
      className={`${className ?? ''} ${moving ? 'gradient-name-moving' : ''}`.trim()}
      style={{
        background: `linear-gradient(90deg, ${profile!.name_gradient_primary}, ${profile!.name_gradient_secondary})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {name}
    </span>
  )
}
