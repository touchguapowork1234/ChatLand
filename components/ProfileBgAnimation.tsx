'use client'

import { useEffect, useRef } from 'react'

// ── Shooting Stars ────────────────────────────────────────────────────────────

interface Star { x: number; y: number; r: number; a: number }
interface Streak { x: number; y: number; len: number; speed: number; angle: number; life: number; maxLife: number }

export function ShootingStarsAnimation({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Static star field
    const stars: Star[] = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      a: Math.random() * 0.5 + 0.3,
    }))

    // Shooting streaks pool
    const streaks: Streak[] = []
    let nextStreak = 60

    const spawnStreak = () => {
      streaks.push({
        x:       Math.random() * 0.9,
        y:       Math.random() * 0.5,
        len:     90 + Math.random() * 80,
        speed:   6 + Math.random() * 5,
        angle:   Math.PI / 5 + (Math.random() - 0.5) * 0.3,
        life:    0,
        maxLife: 40 + Math.random() * 20,
      })
    }

    let frame = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)

      // Night sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#06080f')
      sky.addColorStop(1, '#0d1a2a')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Static stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.a})`
        ctx.fill()
      }

      // Glowing moon (top-right area)
      const mx = W * 0.82
      const my = H * 0.18
      const mr = 28

      // Outer glow layers
      for (let i = 3; i >= 1; i--) {
        const g = ctx.createRadialGradient(mx, my, mr, mx, my, mr + i * 22)
        g.addColorStop(0, `rgba(255,248,200,${0.06 / i})`)
        g.addColorStop(1, 'rgba(255,248,200,0)')
        ctx.beginPath()
        ctx.arc(mx, my, mr + i * 22, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      // Moon disc
      const moonGrad = ctx.createRadialGradient(mx - 6, my - 6, 4, mx, my, mr)
      moonGrad.addColorStop(0, '#fffde0')
      moonGrad.addColorStop(0.6, '#f5e87a')
      moonGrad.addColorStop(1, '#e0c94a')
      ctx.beginPath()
      ctx.arc(mx, my, mr, 0, Math.PI * 2)
      ctx.fillStyle = moonGrad
      ctx.fill()

      // Moon crater hints
      ctx.fillStyle = 'rgba(180,160,40,0.18)'
      ctx.beginPath(); ctx.arc(mx + 8, my + 6, 5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(mx - 9, my + 12, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(mx + 4, my - 10, 2.5, 0, Math.PI * 2); ctx.fill()

      // Shooting streaks
      frame++
      if (frame >= nextStreak) {
        spawnStreak()
        nextStreak = frame + 90 + Math.floor(Math.random() * 120)
      }

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]
        s.life++
        if (s.life > s.maxLife) { streaks.splice(i, 1); continue }

        const progress = s.life / s.maxLife
        const alpha    = progress < 0.3
          ? progress / 0.3
          : progress > 0.7
            ? (1 - progress) / 0.3
            : 1

        const cx = (s.x + Math.cos(s.angle) * s.speed * s.life / 60) * W
        const cy = (s.y + Math.sin(s.angle) * s.speed * s.life / 60) * H
        const tx = cx - Math.cos(s.angle) * s.len
        const ty = cy - Math.sin(s.angle) * s.len

        const grad = ctx.createLinearGradient(tx, ty, cx, cy)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, `rgba(255,255,255,${alpha * 0.9})`)

        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(cx, cy)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Head glow
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 4)
        hg.addColorStop(0, `rgba(255,255,255,${alpha * 0.8})`)
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = hg
        ctx.fill()
      }
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ borderRadius: 'inherit', opacity }}
    />
  )
}

// ── Blood Moon ────────────────────────────────────────────────────────────────

interface Ember { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number }

export function BloodmoonAnimation({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.35 + 0.1,
      tinted: Math.random() > 0.55,
    }))

    const embers: Ember[] = Array.from({ length: 55 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.random() * 1.6,
      speed: 0.07 + Math.random() * 0.16,
      drift: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
      a: 0.4 + Math.random() * 0.55,
    }))

    const moonImg = new Image()
    moonImg.src = '/bloodmoon_moon.png'

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Deep crimson sky
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#050000')
      sky.addColorStop(0.5, '#110003')
      sky.addColorStop(1, '#1c0007')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.tinted ? `rgba(255,110,70,${s.a})` : `rgba(255,190,170,${s.a})`
        ctx.fill()
      }

      // Blood moon
      const mr = Math.min(W, H) * 0.13
      const mx = W * 0.80; const my = H * 0.20

      // Moon image (clipped to circle)
      if (moonImg.complete && moonImg.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(moonImg, mx - mr, my - mr, mr * 2, mr * 2)
        ctx.restore()
      } else {
        // Fallback disc while image loads
        const mg = ctx.createRadialGradient(mx - mr * 0.28, my - mr * 0.28, mr * 0.08, mx, my, mr)
        mg.addColorStop(0, '#ff4a00'); mg.addColorStop(0.75, '#8b0000'); mg.addColorStop(1, '#540000')
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill()
      }

      // Rising embers
      for (const e of embers) {
        e.y -= e.speed / 100
        e.x += (e.drift + Math.sin(t * 1.4 + e.phase) * 0.14) / 100
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random() }
        if (e.x > 1.05) e.x = -0.05
        if (e.x < -0.05) e.x = 1.05

        const px = e.x * W; const py = e.y * H
        const g = ctx.createRadialGradient(px, py, 0, px, py, e.r * 3.2)
        g.addColorStop(0, `rgba(255,90,0,${e.a * 0.85})`)
        g.addColorStop(0.5, `rgba(200,20,0,${e.a * 0.35})`)
        g.addColorStop(1, 'rgba(140,0,0,0)')
        ctx.beginPath(); ctx.arc(px, py, e.r * 3.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, e.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,150,40,${e.a})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit', opacity }} />
  )
}

// ── Blue Moon ─────────────────────────────────────────────────────────────────

interface Wisp { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number; pulse: number }

export function BluemoonAnimation({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.5 + 0.15,
      tinted: Math.random() > 0.5,
    }))

    const wisps: Wisp[] = Array.from({ length: 50 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.8 + Math.random() * 2.2,
      speed: 0.05 + Math.random() * 0.12,
      drift: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      a: 0.3 + Math.random() * 0.5,
      pulse: Math.random() * Math.PI * 2,
    }))

    let t = 0
    const moonImg = new Image()
    moonImg.src = '/bluemoon_moon.png'

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Deep midnight blue sky
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#020510')
      sky.addColorStop(0.5, '#050d1e')
      sky.addColorStop(1, '#071528')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // Subtle blue aurora shimmer at top
      const aurora = ctx.createLinearGradient(0, 0, W, H * 0.4)
      aurora.addColorStop(0, 'rgba(30,80,180,0.06)')
      aurora.addColorStop(0.5, 'rgba(60,120,255,0.03)')
      aurora.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = aurora; ctx.fillRect(0, 0, W, H * 0.4)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.tinted ? `rgba(140,180,255,${s.a})` : `rgba(200,220,255,${s.a})`
        ctx.fill()
      }

      // Blue moon
      const mr = Math.min(W, H) * 0.13
      const mx = W * 0.80; const my = H * 0.20

      if (moonImg.complete && moonImg.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(moonImg, mx - mr, my - mr, mr * 2, mr * 2)
        ctx.restore()
      } else {
        const mg = ctx.createRadialGradient(mx - mr * 0.28, my - mr * 0.28, mr * 0.08, mx, my, mr)
        mg.addColorStop(0, '#a0c8ff'); mg.addColorStop(0.6, '#4080e0'); mg.addColorStop(1, '#1030a0')
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill()
      }

      // Floating blue wisps / luminescent orbs
      for (const w of wisps) {
        w.y -= w.speed / 100
        w.x += (w.drift + Math.sin(t * 0.8 + w.phase) * 0.18) / 100
        w.pulse += 0.03
        if (w.y < -0.02) { w.y = 1.02; w.x = Math.random() }
        if (w.x > 1.05) w.x = -0.05
        if (w.x < -0.05) w.x = 1.05

        const px = w.x * W; const py = w.y * H
        const pa = w.a * (0.7 + Math.sin(w.pulse) * 0.3)
        const g = ctx.createRadialGradient(px, py, 0, px, py, w.r * 3.5)
        g.addColorStop(0, `rgba(100,160,255,${pa * 0.9})`)
        g.addColorStop(0.4, `rgba(60,100,220,${pa * 0.4})`)
        g.addColorStop(1, 'rgba(20,40,180,0)')
        ctx.beginPath(); ctx.arc(px, py, w.r * 3.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, w.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,225,255,${pa})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit', opacity }} />
  )
}

// ── Snow ──────────────────────────────────────────────────────────────────────

interface Flake { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number }

export function SnowAnimation({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const COUNT = 180
    const flakes: Flake[] = Array.from({ length: COUNT }, () => ({
      x:     Math.random(),
      y:     Math.random(),
      r:     0.8 + Math.random() * 2.4,
      speed: 0.15 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.6,
      phase: Math.random() * Math.PI * 2,
      a:     0.4 + Math.random() * 0.6,
    }))

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width
      const H = canvas.height
      t += 0.016

      ctx.clearRect(0, 0, W, H)

      // Subtle dark overlay to set atmosphere
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, 'rgba(10,15,30,0.55)')
      bg.addColorStop(1, 'rgba(5,10,20,0.55)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (const f of flakes) {
        f.y += f.speed / 100
        f.x += (f.drift + Math.sin(t + f.phase) * 0.2) / 100
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random() }
        if (f.x > 1.05) f.x = -0.05
        if (f.x < -0.05) f.x = 1.05

        const px = f.x * W
        const py = f.y * H

        // Soft glow
        const g = ctx.createRadialGradient(px, py, 0, px, py, f.r * 2.5)
        g.addColorStop(0, `rgba(220,240,255,${f.a})`)
        g.addColorStop(1, 'rgba(220,240,255,0)')
        ctx.beginPath()
        ctx.arc(px, py, f.r * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        // Core flake dot
        ctx.beginPath()
        ctx.arc(px, py, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${f.a})`
        ctx.fill()
      }
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ borderRadius: 'inherit', opacity }}
    />
  )
}
