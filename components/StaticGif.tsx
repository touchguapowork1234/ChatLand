'use client'

import { useEffect, useRef } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export default function StaticGif({ src, alt, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')?.drawImage(img, 0, 0)
    }
    img.src = src
  }, [src])

  return <canvas ref={canvasRef} aria-label={alt} className={className} style={style} />
}
