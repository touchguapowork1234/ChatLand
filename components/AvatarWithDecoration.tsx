import { decorationById } from '@/lib/decorations'

interface Props {
  avatarUrl?: string | null
  displayInitial: string
  size: number          // avatar circle diameter in px
  decoration?: string | null
  className?: string
  onClick?: () => void
}

const SCALE = 1.3

export default function AvatarWithDecoration({ avatarUrl, displayInitial, size, decoration, className = '', onClick }: Props) {
  const dec     = decorationById(decoration)
  const decSize = dec ? size * SCALE : size
  const expand  = dec ? (decSize - size) / 2 : 0

  return (
    // Outer div is decSize so decoration never overflows and gets clipped.
    // Negative margin pulls surrounding layout back to size×size footprint.
    <div
      className={`relative shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width:  decSize,
        height: decSize,
        margin: -expand,
      }}
      onClick={onClick}
    >
      {/* Avatar circle — centered inside the larger wrapper */}
      <div
        className="rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center text-white font-bold select-none absolute"
        style={{
          width:     size,
          height:    size,
          top:       '50%',
          left:      '50%',
          transform: 'translate(-50%, -50%)',
          fontSize:  Math.round(size * 0.38),
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : displayInitial}
      </div>

      {/* Decoration — centered, sits on top of avatar */}
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
            transform: 'translate(-50%, -47%)',
            zIndex:    10,
          }}
        />
      )}
    </div>
  )
}
