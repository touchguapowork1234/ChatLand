import { decorationById } from '@/lib/decorations'

interface Props {
  avatarUrl?: string | null
  displayInitial: string
  size: number          // avatar circle diameter in px
  decoration?: string | null
  className?: string
  onClick?: () => void
}

// The decoration PNG (288×288) has opaque pixels starting at x=5 and ending at x=282.
// To land those tips exactly on the left/right circle edges:
//   decSize = size * 288 / 277
//   offset  = -5 * size / 277
const IMG_W   = 288
const TIP_L   = 5    // leftmost opaque pixel
const TIP_R   = 282  // rightmost opaque pixel
const CONTENT = TIP_R - TIP_L  // 277

export default function AvatarWithDecoration({ avatarUrl, displayInitial, size, decoration, className = '', onClick }: Props) {
  const dec     = decorationById(decoration)
  const decSize = size * IMG_W / CONTENT         // ≈ 1.04 × size
  const offset  = -(TIP_L * size / CONTENT)     // ≈ -0.018 × size

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
