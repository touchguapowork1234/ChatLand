'use client'

import { useEffect, useRef } from 'react'

// ── Shooting Stars (compact, for DM sidebar entries) ──────────────────────────

interface Star   { x: number; y: number; r: number; a: number }
interface Streak { x: number; y: number; len: number; speed: number; angle: number; life: number; maxLife: number }

export function DmShootingStarsOverlay() {
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

    const stars: Star[] = Array.from({ length: 55 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.9 + 0.2,
      a: Math.random() * 0.5 + 0.25,
    }))

    const streaks: Streak[] = []
    let nextStreak = 40
    let frame = 0

    const spawnStreak = () => streaks.push({
      x: Math.random() * 0.85, y: Math.random() * 0.6,
      len: 40 + Math.random() * 40,
      speed: 5 + Math.random() * 4,
      angle: Math.PI / 5 + (Math.random() - 0.5) * 0.3,
      life: 0, maxLife: 30 + Math.random() * 20,
    })

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Dark overlay
      ctx.fillStyle = 'rgba(6,8,18,0.72)'
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.a})`
        ctx.fill()
      }

      // Moon (top-right, compact)
      const mx = W * 0.84, my = H * 0.28, mr = Math.min(W, H) * 0.14
      for (let i = 2; i >= 1; i--) {
        const g = ctx.createRadialGradient(mx, my, mr, mx, my, mr + i * 8)
        g.addColorStop(0, `rgba(255,248,200,${0.07 / i})`)
        g.addColorStop(1, 'rgba(255,248,200,0)')
        ctx.beginPath(); ctx.arc(mx, my, mr + i * 8, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
      }
      const mg = ctx.createRadialGradient(mx - mr * 0.2, my - mr * 0.2, mr * 0.15, mx, my, mr)
      mg.addColorStop(0, '#fffde0'); mg.addColorStop(0.6, '#f5e87a'); mg.addColorStop(1, '#e0c94a')
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2)
      ctx.fillStyle = mg; ctx.fill()
      ctx.fillStyle = 'rgba(180,160,40,0.18)'
      ctx.beginPath(); ctx.arc(mx + mr * 0.28, my + mr * 0.2, mr * 0.18, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(mx - mr * 0.32, my + mr * 0.38, mr * 0.12, 0, Math.PI * 2); ctx.fill()

      // Shooting streaks
      frame++
      if (frame >= nextStreak) { spawnStreak(); nextStreak = frame + 70 + Math.floor(Math.random() * 100) }

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]; s.life++
        if (s.life > s.maxLife) { streaks.splice(i, 1); continue }
        const p = s.life / s.maxLife
        const alpha = p < 0.3 ? p / 0.3 : p > 0.7 ? (1 - p) / 0.3 : 1
        const cx = (s.x + Math.cos(s.angle) * s.speed * s.life / 60) * W
        const cy = (s.y + Math.sin(s.angle) * s.speed * s.life / 60) * H
        const tx = cx - Math.cos(s.angle) * s.len
        const ty = cy - Math.sin(s.angle) * s.len
        const grad = ctx.createLinearGradient(tx, ty, cx, cy)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, `rgba(255,255,255,${alpha * 0.9})`)
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, cy)
        ctx.strokeStyle = grad; ctx.lineWidth = 1.2; ctx.stroke()
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3)
        hg.addColorStop(0, `rgba(255,255,255,${alpha * 0.8})`)
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2)
        ctx.fillStyle = hg; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit' }} />
  )
}

// ── Blood Moon (compact, for DM sidebar entries) ─────────────────────────────

interface BloodEmber { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number }

export function DmBloodmoonOverlay() {
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

    const stars = Array.from({ length: 45 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.9 + 0.2,
      a: Math.random() * 0.3 + 0.1,
      tinted: Math.random() > 0.55,
    }))

    const embers: BloodEmber[] = Array.from({ length: 28 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      speed: 0.08 + Math.random() * 0.18,
      drift: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      a: 0.4 + Math.random() * 0.5,
    }))

    const moonImg = new Image()
    moonImg.src = '/bloodmoon_moon.png'

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Deep crimson overlay
      ctx.fillStyle = 'rgba(8,0,2,0.74)'
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.tinted ? `rgba(255,100,60,${s.a})` : `rgba(255,180,160,${s.a})`
        ctx.fill()
      }

      // Blood moon
      const mr = Math.min(W, H) * 0.14
      const mx = W * 0.84; const my = H * 0.28

      // Moon image (clipped to circle)
      if (moonImg.complete && moonImg.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(moonImg, mx - mr, my - mr, mr * 2, mr * 2)
        ctx.restore()
      } else {
        const mg = ctx.createRadialGradient(mx - mr * 0.22, my - mr * 0.22, mr * 0.1, mx, my, mr)
        mg.addColorStop(0, '#ff4400'); mg.addColorStop(0.85, '#7a0000'); mg.addColorStop(1, '#4a0000')
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill()
      }

      // Embers
      for (const e of embers) {
        e.y -= e.speed / 100
        e.x += (e.drift + Math.sin(t * 1.4 + e.phase) * 0.14) / 100
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random() }
        if (e.x > 1.05) e.x = -0.05
        if (e.x < -0.05) e.x = 1.05

        const px = e.x * W; const py = e.y * H
        const g = ctx.createRadialGradient(px, py, 0, px, py, e.r * 3)
        g.addColorStop(0, `rgba(255,80,0,${e.a * 0.8})`); g.addColorStop(1, 'rgba(140,0,0,0)')
        ctx.beginPath(); ctx.arc(px, py, e.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, e.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,140,30,${e.a})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit' }} />
  )
}

// ── Blue Moon (compact, for DM sidebar entries) ───────────────────────────────

interface BlueWisp { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number; pulse: number }

export function DmBluemoonOverlay() {
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

    const stars = Array.from({ length: 45 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.9 + 0.2,
      a: Math.random() * 0.4 + 0.1,
      tinted: Math.random() > 0.5,
    }))

    const wisps: BlueWisp[] = Array.from({ length: 25 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.random() * 1.4,
      speed: 0.06 + Math.random() * 0.14,
      drift: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      a: 0.35 + Math.random() * 0.45,
      pulse: Math.random() * Math.PI * 2,
    }))

    const moonImg = new Image()
    moonImg.src = '/bluemoon_moon.png'

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Deep blue overlay
      ctx.fillStyle = 'rgba(2,5,18,0.74)'
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.tinted ? `rgba(130,170,255,${s.a})` : `rgba(200,215,255,${s.a})`
        ctx.fill()
      }

      // Blue moon
      const mr = Math.min(W, H) * 0.14
      const mx = W * 0.84; const my = H * 0.28

      if (moonImg.complete && moonImg.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(moonImg, mx - mr, my - mr, mr * 2, mr * 2)
        ctx.restore()
      } else {
        const mg = ctx.createRadialGradient(mx - mr * 0.22, my - mr * 0.22, mr * 0.1, mx, my, mr)
        mg.addColorStop(0, '#a0c8ff'); mg.addColorStop(0.6, '#3060d0'); mg.addColorStop(1, '#102080')
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill()
      }

      // Wisps
      for (const w of wisps) {
        w.y -= w.speed / 100
        w.x += (w.drift + Math.sin(t * 0.8 + w.phase) * 0.18) / 100
        w.pulse += 0.03
        if (w.y < -0.02) { w.y = 1.02; w.x = Math.random() }
        if (w.x > 1.05) w.x = -0.05
        if (w.x < -0.05) w.x = 1.05

        const px = w.x * W; const py = w.y * H
        const pa = w.a * (0.7 + Math.sin(w.pulse) * 0.3)
        const g = ctx.createRadialGradient(px, py, 0, px, py, w.r * 3.2)
        g.addColorStop(0, `rgba(100,160,255,${pa * 0.85})`)
        g.addColorStop(0.4, `rgba(50,90,210,${pa * 0.35})`)
        g.addColorStop(1, 'rgba(20,40,180,0)')
        ctx.beginPath(); ctx.arc(px, py, w.r * 3.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, w.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190,215,255,${pa})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit' }} />
  )
}

// ── Solar (compact, for DM sidebar entries) ───────────────────────────────────

interface SolarMote { x: number; y: number; r: number; vx: number; vy: number; phase: number; a: number }

export function DmSolarOverlay() {
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

    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.8 + 0.2,
      a: Math.random() * 0.4 + 0.1,
      warm: Math.random() > 0.45,
    }))

    const motes: SolarMote[] = Array.from({ length: 28 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      vx: 0.04 + Math.random() * 0.1,
      vy: (Math.random() - 0.5) * 0.04,
      phase: Math.random() * Math.PI * 2,
      a: 0.3 + Math.random() * 0.45,
    }))

    const moonImg = new Image(); moonImg.src = '/solar_moon.png'
    const saturnImg = new Image(); saturnImg.src = '/solar_saturn.png'

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Dark cold overlay
      ctx.fillStyle = 'rgba(2,4,10,0.74)'
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of stars) {
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.warm ? `rgba(180,210,255,${s.a})` : `rgba(240,245,255,${s.a})`
        ctx.fill()
      }

      // Moon — top-right, gentle pulse
      const moonPulse = 1 + Math.sin(t * 0.7) * 0.04
      const mr = Math.min(W, H) * 0.14 * moonPulse
      const mx = W * 0.84; const my = H * 0.28
      if (moonImg.complete && moonImg.naturalWidth > 0)
        ctx.drawImage(moonImg, mx - mr, my - mr, mr * 2, mr * 2)

      // Saturn — lower-left, natural aspect ratio, offset pulse
      const saturnPulse = 1 + Math.sin(t * 0.5 + 1.4) * 0.04
      const sh = Math.min(W, H) * 0.16 * saturnPulse
      const sw = saturnImg.complete && saturnImg.naturalWidth > 0
        ? sh * (saturnImg.naturalWidth / saturnImg.naturalHeight)
        : sh
      const sx = W * 0.18; const sy = H * 0.78
      if (saturnImg.complete && saturnImg.naturalWidth > 0)
        ctx.drawImage(saturnImg, sx - sw / 2, sy - sh / 2, sw, sh)

      // Solar wind motes — cold white/silver
      for (const m of motes) {
        m.x += m.vx / 100
        m.y += (m.vy + Math.sin(t * 0.6 + m.phase) * 0.015) / 100
        if (m.x > 1.05) { m.x = -0.05; m.y = Math.random() }
        if (m.y > 1.05) m.y = -0.05
        if (m.y < -0.05) m.y = 1.05

        const px = m.x * W; const py = m.y * H
        const pa = m.a * (0.6 + Math.sin(t * 1.2 + m.phase) * 0.4)
        const g = ctx.createRadialGradient(px, py, 0, px, py, m.r * 3)
        g.addColorStop(0, `rgba(200,220,255,${pa * 0.9})`)
        g.addColorStop(0.5, `rgba(150,185,255,${pa * 0.35})`)
        g.addColorStop(1, 'rgba(80,120,220,0)')
        ctx.beginPath(); ctx.arc(px, py, m.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, m.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230,240,255,${pa})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit' }} />
  )
}

// ── Snow (compact, for DM sidebar entries) ────────────────────────────────────

interface Flake { x: number; y: number; r: number; speed: number; drift: number; phase: number; a: number }

export function DmSnowOverlay() {
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

    const flakes: Flake[] = Array.from({ length: 55 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      speed: 0.12 + Math.random() * 0.28,
      drift: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
      a: 0.4 + Math.random() * 0.5,
    }))

    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const W = canvas.width; const H = canvas.height
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      // Dark overlay
      ctx.fillStyle = 'rgba(5,10,22,0.65)'
      ctx.fillRect(0, 0, W, H)

      for (const f of flakes) {
        f.y += f.speed / 100
        f.x += (f.drift + Math.sin(t + f.phase) * 0.18) / 100
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random() }
        if (f.x > 1.05) f.x = -0.05
        if (f.x < -0.05) f.x = 1.05
        const px = f.x * W; const py = f.y * H
        const g = ctx.createRadialGradient(px, py, 0, px, py, f.r * 2.2)
        g.addColorStop(0, `rgba(220,240,255,${f.a})`)
        g.addColorStop(1, 'rgba(220,240,255,0)')
        ctx.beginPath(); ctx.arc(px, py, f.r * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${f.a})`; ctx.fill()
      }
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 'inherit' }} />
  )
}
