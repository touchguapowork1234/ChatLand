'use client'

import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

const SIZE = 300 // canvas render size

interface Props {
  file: File
  onSave: (blob: Blob) => void
  onCancel: () => void
}

export default function GroupIconCropModal({ file, onSave, onCancel }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const [imgEl, setImgEl]   = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom]     = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })

  // Load the image from the File
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImgEl(img)
      // Reset position and fit zoom so the image fills the circle
      const fit = SIZE / Math.min(img.naturalWidth, img.naturalHeight)
      setZoom(fit)
      setOffset({ x: 0, y: 0 })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Re-draw whenever image, zoom, or offset changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.save()

    // Dark background fill
    ctx.fillStyle = '#313338'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // Circular clip
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    const w = imgEl.naturalWidth  * zoom
    const h = imgEl.naturalHeight * zoom
    const x = (SIZE - w) / 2 + offset.x
    const y = (SIZE - h) / 2 + offset.y
    ctx.drawImage(imgEl, x, y, w, h)

    ctx.restore()
  }, [imgEl, zoom, offset])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }
  const onMouseUp = () => { dragging.current = false }

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    dragging.current = true
    lastPos.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const t = e.touches[0]
    const dx = t.clientX - lastPos.current.x
    const dy = t.clientY - lastPos.current.y
    lastPos.current = { x: t.clientX, y: t.clientY }
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => { if (blob) onSave(blob) }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div
        className="bg-[#2b2d31] rounded-xl p-5 w-[360px] shadow-2xl flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 className="text-[#dbdee1] font-semibold text-base">Align Group Icon</h3>
          <p className="text-xs text-[#949ba4] mt-0.5">Drag to reposition · scroll or use the slider to zoom</p>
        </div>

        {/* Canvas preview */}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="rounded-full cursor-move select-none"
            style={{ width: 220, height: 220, touchAction: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            onWheel={e => {
              e.preventDefault()
              setZoom(z => Math.min(8, Math.max(0.2, z - e.deltaY * 0.005)))
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2">
          <ZoomOut className="w-4 h-4 text-[#949ba4] shrink-0" />
          <input
            type="range"
            min="0.2"
            max="8"
            step="0.01"
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[#5865f2]"
          />
          <ZoomIn className="w-4 h-4 text-[#949ba4] shrink-0" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[#949ba4] hover:text-[#dbdee1] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition-colors font-medium"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
