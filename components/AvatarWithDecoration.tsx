import { decorationById } from '@/lib/decorations'

interface Props {
  avatarUrl?: string | null
  displayInitial: string
  size: number          // avatar circle diameter in px
  decoration?: string | null
  className?: string
  onClick?: () => void
}

const SCALE = 1.5

export default function AvatarWithDecoration({ avatarUrl, displayInitial, size, decoration, className = '', onClick }: Props) {
  const dec     = decorationById(decoration)
  const decSize = size * SCALE

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

      {/* Decoration — centered via CSS transform so it's always perfectly aligned */}
      {dec && (
        <img
          src={dec.src}
          alt={dec.label}
          draggable={false}
          className="absolute pointer-events-none select-none"
          style={{
            width:     decSize,
            height:    'auto',
            top:       '50%',
            left:      '50%',
            transform: 'translate(-50%, -60%)',
            zIndex:    10,
          }}
        />
      )}
    </div>
  )
}
