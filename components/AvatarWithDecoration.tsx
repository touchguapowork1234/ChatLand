import { decorationById } from '@/lib/decorations'

interface Props {
  avatarUrl?: string | null
  displayInitial: string
  size: number          // avatar circle diameter in px
  decoration?: string | null
  className?: string
  onClick?: () => void
}

// Scale factor: decoration image is designed so the face area ≈ 62% of image width.
// Inverting that keeps the avatar circle perfectly inscribed inside the decoration.
const SCALE = 1.62

export default function AvatarWithDecoration({ avatarUrl, displayInitial, size, decoration, className = '', onClick }: Props) {
  const dec = decorationById(decoration)
  const decSize = Math.round(size * SCALE)
  const offset  = Math.round((decSize - size) / 2)

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

      {/* Decoration overlay — sits outside the overflow-hidden circle */}
      {dec && (
        <img
          src={dec.src}
          alt={dec.label}
          draggable={false}
          className="absolute pointer-events-none select-none"
          style={{
            width:  decSize,
            height: decSize,
            top:    -offset,
            left:   -offset,
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}
