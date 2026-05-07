import { decorationById } from '@/lib/decorations'

interface Props {
  avatarUrl?: string | null
  displayInitial: string
  size: number          // avatar circle diameter in px
  decoration?: string | null
  className?: string
  onClick?: () => void
}

// Whiskers in the source image are at x=24 and x=264 (out of 288px) at y=144.
// Solving for D so whiskers land exactly on the left/right circle edges gives D = size * 288/240 = size * 1.2.
// The centering offset follows: offset = -(D - size) / 2
const SCALE = 288 / 240  // ≈ 1.2

export default function AvatarWithDecoration({ avatarUrl, displayInitial, size, decoration, className = '', onClick }: Props) {
  const dec    = decorationById(decoration)
  const decSize = Math.round(size * SCALE)
  const offset  = -Math.round((decSize - size) / 2)

  return (
    <div
      className={`relative shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {/* Avatar circle */}
      <div
        className="rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white font-bold select-none w-full h-full"
        style={{ fontSize: Math.round(size * 0.38) }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : displayInitial}
      </div>

      {/* Decoration — scaled so whiskers land exactly on the circle border */}
      {dec && (
        <img
          src={dec.src}
          alt={dec.label}
          draggable={false}
          className="absolute pointer-events-none select-none"
          style={{
            width:  decSize,
            height: decSize,
            top:    offset,
            left:   offset,
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}
