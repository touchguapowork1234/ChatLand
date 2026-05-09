import type { Profile } from '@/lib/types'
import { displayName } from '@/lib/types'

interface Props {
  profile?: Profile | null
  className?: string
}

export default function GradientName({ profile, className }: Props) {
  const name = displayName(profile)
  const hasGradient = !!(
    profile?.is_premium &&
    profile?.name_gradient_enabled &&
    profile?.name_gradient_primary &&
    profile?.name_gradient_secondary
  )

  if (!hasGradient) return <span className={className}>{name}</span>

  return (
    <span
      className={className}
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
