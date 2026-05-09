'use client'

interface Props {
  isRainbow: boolean
  className: string
  children: React.ReactNode
}

export default function RainbowText({ isRainbow, className, children }: Props) {
  return (
    <p className={`${className} ${isRainbow ? 'rainbow-text' : 'text-[#dcddde]'}`}>
      {children}
    </p>
  )
}
