'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, ZoomIn, ZoomOut, Sparkles, Loader2, Bot, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { userTag } from '@/lib/types'
import { useTheme } from './PremiumThemeProvider'
import type { AnimConfig } from './PremiumThemeProvider'
import { DECORATIONS } from '@/lib/decorations'
import AvatarWithDecoration from './AvatarWithDecoration'

type Tab = 'profile' | 'account' | 'admin'

type PremiumCode = { code: string; redeemed_by: string | null; created_at: string }

interface Props {
  profile: Profile
  onClose: () => void
  onUpdated: (updated: Profile) => void
}

const CROP        = 160
const OUT         = 256
const BANNER_W    = 400
const BANNER_H    = 107
const BANNER_OUT_W = 840
const BANNER_OUT_H = 224

export default function SettingsModal({ profile, onClose, onUpdated }: Props) {
  const supabase = createClient()
  const { setTheme, resetTheme, setAnimations } = useTheme()
  const [tab, setTab] = useState<Tab>('profile')

  // ── Profile tab ──
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [bio, setBio]                 = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl]     = useState(profile.avatar_url ?? '')
  const [alignerSrc, setAlignerSrc]   = useState<string | null>(null)
  const [offset, setOffset]           = useState({ x: 0, y: 0 })
  const [zoom, setZoom]               = useState(1)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  const fileRef  = useRef<HTMLInputElement>(null)
  const dragRef  = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  // ── Account tab ──
  const [tag, setTag]           = useState(profile.tag)
  const [tagLoading, setTagLoading] = useState(false)
  const [tagMsg, setTagMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  // ── Yasu Premium ──
  const [isPremium, setIsPremium]       = useState(profile.is_premium ?? false)
  const [codeInput, setCodeInput]       = useState('')
  const [codeLoading, setCodeLoading]   = useState(false)
  const [codeMsg, setCodeMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Banner
  const [bannerUrl, setBannerUrl]         = useState(profile.banner_url ?? '')
  const [bannerSrc, setBannerSrc]         = useState<string | null>(null)
  const [bannerOffset, setBannerOffset]   = useState({ x: 0, y: 0 })
  const [bannerZoom, setBannerZoom]       = useState(1)
  const bannerDragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const bannerFileRef = useRef<HTMLInputElement>(null)

  // Colors + toggles
  const [themeEnabled,   setThemeEnabled]   = useState(profile.theme_enabled  ?? true)
  const [cardEnabled,    setCardEnabled]    = useState(profile.card_enabled   ?? true)
  const [themePrimary,   setThemePrimary]   = useState(profile.theme_primary   ?? '#5865f2')
  const [themeSecondary, setThemeSecondary] = useState(profile.theme_secondary ?? '#7983f5')
  const [cardPrimary,    setCardPrimary]    = useState(profile.card_primary    ?? '#5865f2')
  const [cardSecondary,  setCardSecondary]  = useState(profile.card_secondary  ?? '#7983f5')

  const handleThemeToggle = (enabled: boolean) => {
    setThemeEnabled(enabled)
  }

  // Public profile
  const [profileTiltEnabled, setProfileTiltEnabled] = useState(profile.profile_tilt_enabled ?? false)
  const [bgAnimEnabled, setBgAnimEnabled] = useState(!!(profile.profile_bg_animation))
  const [bgAnimType, setBgAnimType]       = useState<string>(profile.profile_bg_animation ?? 'shooting_stars')
  const [bgAnimOpacity, setBgAnimOpacity] = useState<number>(profile.profile_bg_opacity ?? 1)
  const [decoration, setDecoration]       = useState<string | null>(profile.profile_decoration ?? null)
  const [glowEnabled, setGlowEnabled]     = useState(profile.profile_glow_enabled ?? false)
  const [glowColor, setGlowColor]         = useState(profile.profile_glow_color ?? '#5865f2')
  const [glowOpacity, setGlowOpacity]     = useState(profile.profile_glow_opacity ?? 0.8)

  // Animation settings
  const [animEnabled,           setAnimEnabled]           = useState(profile.animations_enabled   ?? false)
  const [animProfileFade,       setAnimProfileFade]       = useState(profile.anim_profile_fade    ?? true)
  const [animChatFade,          setAnimChatFade]          = useState(profile.anim_chat_fade       ?? true)
  const [animGradient,          setAnimGradient]          = useState(profile.anim_gradient        ?? true)
  const [animHoverGlow,         setAnimHoverGlow]         = useState(profile.anim_hover_glow      ?? false)
  const [animMessageEntrance,   setAnimMessageEntrance]   = useState(profile.anim_message_entrance ?? true)
  const [animSmoothTransitions, setAnimSmoothTransitions] = useState(profile.anim_smooth_transitions ?? false)

  const buildAnimConfig = (overrides: Partial<AnimConfig> = {}): AnimConfig => ({
    isPremium:        isPremium,
    enabled:          animEnabled,
    profileFade:      animProfileFade,
    chatFade:         animChatFade,
    gradient:         animGradient,
    hoverGlow:        animHoverGlow,
    messageEntrance:  animMessageEntrance,
    smoothTransitions:animSmoothTransitions,
    ...overrides,
  })

  const [premiumLoading, setPremiumLoading] = useState(false)
  const [premiumMsg, setPremiumMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // ── AI Character ──
  const [hasAiAccess, setHasAiAccess]   = useState(profile.has_ai_access ?? false)
  const [hideAi, setHideAi]             = useState(profile.hide_ai ?? false)
  const [isDirty, setIsDirty]           = useState(false)
  const [saveAllLoading, setSaveAllLoading] = useState(false)
  const [aiCodeInput, setAiCodeInput]   = useState('')
  const [aiCodeLoading, setAiCodeLoading] = useState(false)
  const [aiCodeMsg, setAiCodeMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  // Mako-only AI character editor
  const [aiCharName, setAiCharName]         = useState('')
  const [aiCharAvatarUrl, setAiCharAvatarUrl] = useState<string | null>(null)
  const [aiCharNewFile, setAiCharNewFile]   = useState<File | null>(null)
  const [aiCharPreview, setAiCharPreview]   = useState<string | null>(null)
  const [aiCharLoading, setAiCharLoading]   = useState(false)
  const [aiCharMsg, setAiCharMsg]           = useState<{ ok: boolean; text: string } | null>(null)
  const aiCharFileRef = useRef<HTMLInputElement>(null)

  // Load AI character data if this is mako
  useEffect(() => {
    if (profile.username !== 'mako' || profile.tag !== '0000') return
    supabase.from('ai_character').select('name, avatar_url').eq('id', 1).single()
      .then(({ data }) => {
        if (data) { setAiCharName(data.name); setAiCharAvatarUrl(data.avatar_url) }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Admin tab ──
  const [adminCodes, setAdminCodes]   = useState<PremiumCode[]>([])
  const [adminLoaded, setAdminLoaded] = useState(false)
  const [genLoading, setGenLoading]   = useState(false)
  const [genMsg, setGenMsg]           = useState<{ ok: boolean; text: string } | null>(null)
  const [copiedCode, setCopiedCode]   = useState<string | null>(null)

  const loadAdminCodes = async () => {
    const { data } = await supabase
      .from('premium_codes')
      .select('code, redeemed_by, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setAdminCodes((data ?? []) as PremiumCode[])
    setAdminLoaded(true)
  }

  const generateCode = async () => {
    setGenLoading(true)
    setGenMsg(null)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const code = `YASU-${seg()}-${seg()}-${seg()}`
    const { error } = await supabase.from('premium_codes').insert({ code })
    if (error) {
      setGenMsg({ ok: false, text: 'Failed to generate code.' })
    } else {
      setGenMsg({ ok: true, text: `Code generated: ${code}` })
      loadAdminCodes()
    }
    setGenLoading(false)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // ── Avatar pick ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setAlignerSrc(reader.result as string)
      setOffset({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Avatar drag handlers ──
  const onPD = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPM = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.ox + e.clientX - dragRef.current.sx,
      y: dragRef.current.oy + e.clientY - dragRef.current.sy,
    })
  }
  const onPU = () => { dragRef.current = null }

  // ── Canvas crop → Supabase upload (avatar) ──
  const cropAndUpload = async (): Promise<string | null> => {
    if (!alignerSrc) return null
    const img = new Image()
    img.src = alignerSrc
    await new Promise(r => { img.onload = r })

    const fitScale = Math.max(CROP / img.naturalWidth, CROP / img.naturalHeight)
    const fw = img.naturalWidth * fitScale
    const fh = img.naturalHeight * fitScale
    const fx = (CROP - fw) / 2
    const fy = (CROP - fh) / 2
    const s  = OUT / CROP

    const canvas = document.createElement('canvas')
    canvas.width = OUT; canvas.height = OUT
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.clip()

    const imgX = ((fx - CROP / 2) * zoom + CROP / 2 + offset.x) * s
    const imgY = ((fy - CROP / 2) * zoom + CROP / 2 + offset.y) * s
    ctx.drawImage(img, imgX, imgY, fw * zoom * s, fh * zoom * s)

    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        if (!blob) { resolve(null); return }
        const path = `${profile.id}.jpg`
        const { error } = await supabase.storage
          .from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (error) { resolve(null); return }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        resolve(`${data.publicUrl}?t=${Date.now()}`)
      }, 'image/jpeg', 0.92)
    })
  }

  // ── Save profile ──
  const saveProfile = async () => {
    setProfileLoading(true)
    setProfileMsg(null)

    let newUrl: string | null = null
    if (alignerSrc) {
      newUrl = await cropAndUpload()
      if (!newUrl) {
        setProfileMsg({ ok: false, text: 'Avatar upload failed. Make sure the "avatars" storage bucket exists.' })
        setProfileLoading(false)
        return
      }
    }

    const patch: Partial<Profile> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      ...(newUrl ? { avatar_url: newUrl } : {}),
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    if (error) {
      setProfileMsg({ ok: false, text: 'Failed to save profile. Please try again.' })
    } else {
      if (newUrl) setAvatarUrl(newUrl)
      setAlignerSrc(null)
      setProfileMsg({ ok: true, text: 'Profile saved!' })
      onUpdated({ ...profile, ...patch, avatar_url: newUrl ?? profile.avatar_url })
    }
    setProfileLoading(false)
  }

  // ── Save tag ──
  const saveTag = async () => {
    setTagMsg(null)
    if (!/^\d{4}$/.test(tag)) { setTagMsg({ ok: false, text: 'Tag must be exactly 4 digits.' }); return }
    if (tag === profile.tag)  { setTagMsg({ ok: false, text: 'That is already your tag.' }); return }
    setTagLoading(true)

    const { data: taken } = await supabase.from('profiles').select('id')
      .ilike('username', profile.username).eq('tag', tag).single()
    if (taken) {
      setTagMsg({ ok: false, text: `${profile.username}#${tag} is already taken.` })
      setTagLoading(false); return
    }

    const { error } = await supabase.from('profiles').update({ tag }).eq('id', profile.id)
    if (error) {
      setTagMsg({ ok: false, text: 'Failed to update. Please try again.' })
    } else {
      setTagMsg({ ok: true, text: `Tag updated to #${tag}!` })
      onUpdated({ ...profile, tag })
    }
    setTagLoading(false)
  }

  // ── Redeem premium code ──
  const redeemCode = async () => {
    setCodeMsg(null)
    const code = codeInput.trim()
    if (!code) return
    setCodeLoading(true)

    const { data: row } = await supabase
      .from('premium_codes')
      .select('code, redeemed_by')
      .eq('code', code)
      .single()

    if (!row) {
      setCodeMsg({ ok: false, text: 'Invalid code.' })
      setCodeLoading(false); return
    }
    if (row.redeemed_by) {
      setCodeMsg({ ok: false, text: 'This code has already been redeemed.' })
      setCodeLoading(false); return
    }

    const { error: updateErr } = await supabase
      .from('premium_codes')
      .update({ redeemed_by: profile.id, redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .is('redeemed_by', null)

    if (updateErr) {
      setCodeMsg({ ok: false, text: 'Failed to redeem. Try again.' })
      setCodeLoading(false); return
    }

    await supabase.from('profiles').update({ is_premium: true }).eq('id', profile.id)
    setIsPremium(true)
    setCodeInput('')
    setCodeMsg({ ok: true, text: 'Yasu Premium activated!' })
    onUpdated({ ...profile, is_premium: true })
    setCodeLoading(false)
  }

  // ── Dirty detection ──
  useEffect(() => {
    const dirty =
      displayName !== (profile.display_name ?? '') ||
      bio !== (profile.bio ?? '') ||
      !!alignerSrc ||
      tag !== profile.tag ||
      (isPremium && (
        !!bannerSrc ||
        themeEnabled     !== (profile.theme_enabled      ?? true)  ||
        cardEnabled      !== (profile.card_enabled       ?? true)  ||
        themePrimary     !== (profile.theme_primary      ?? '#5865f2') ||
        themeSecondary   !== (profile.theme_secondary    ?? '#7983f5') ||
        cardPrimary      !== (profile.card_primary       ?? '#5865f2') ||
        cardSecondary    !== (profile.card_secondary     ?? '#7983f5') ||
        profileTiltEnabled !== (profile.profile_tilt_enabled ?? false) ||
        bgAnimEnabled    !== !!(profile.profile_bg_animation) ||
        bgAnimOpacity    !== (profile.profile_bg_opacity ?? 1) ||
        decoration       !== (profile.profile_decoration ?? null) ||
        glowEnabled      !== (profile.profile_glow_enabled  ?? false) ||
        glowColor        !== (profile.profile_glow_color    ?? '#5865f2') ||
        glowOpacity      !== (profile.profile_glow_opacity  ?? 0.8) ||
        animEnabled          !== (profile.animations_enabled    ?? false) ||
        animProfileFade      !== (profile.anim_profile_fade     ?? true)  ||
        animChatFade         !== (profile.anim_chat_fade        ?? true)  ||
        animGradient         !== (profile.anim_gradient         ?? true)  ||
        animHoverGlow        !== (profile.anim_hover_glow       ?? false) ||
        animMessageEntrance  !== (profile.anim_message_entrance ?? true)  ||
        animSmoothTransitions!== (profile.anim_smooth_transitions ?? false)
      ))
    setIsDirty(dirty)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, bio, alignerSrc, tag, isPremium, bannerSrc, themeEnabled, cardEnabled,
      themePrimary, themeSecondary, cardPrimary, cardSecondary, profileTiltEnabled,
      bgAnimEnabled, bgAnimOpacity, decoration, glowEnabled, glowColor, glowOpacity,
      animEnabled, animProfileFade, animChatFade, animGradient, animHoverGlow,
      animMessageEntrance, animSmoothTransitions])

  // ── Save all changed settings ──
  const saveAll = async () => {
    setSaveAllLoading(true)
    const jobs: Promise<void>[] = []
    if (displayName !== (profile.display_name ?? '') || bio !== (profile.bio ?? '') || !!alignerSrc)
      jobs.push(saveProfile())
    if (tag !== profile.tag && tag.length === 4)
      jobs.push(saveTag())
    if (isPremium)
      jobs.push(savePremiumSettings())
    await Promise.all(jobs)
    setSaveAllLoading(false)
    setIsDirty(false)
  }

  // ── Toggle hide AI ──
  const toggleHideAi = async (val: boolean) => {
    setHideAi(val)
    await supabase.from('profiles').update({ hide_ai: val }).eq('id', profile.id)
    onUpdated({ ...profile, hide_ai: val })
  }

  // ── Redeem AI character code ──
  const redeemAiCode = async () => {
    setAiCodeMsg(null)
    const code = aiCodeInput.trim()
    if (!code) return
    setAiCodeLoading(true)

    const res = await fetch('/api/redeem-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()

    if (!data.ok) {
      setAiCodeMsg({ ok: false, text: data.message ?? 'Invalid code.' })
      setAiCodeLoading(false); return
    }

    setHasAiAccess(true)
    setAiCodeInput('')
    setAiCodeMsg({ ok: true, text: 'AI Character unlocked!' })
    onUpdated({ ...profile, has_ai_access: true })
    setAiCodeLoading(false)
  }

  // ── Save AI character (mako only) ──
  const saveAiCharacter = async () => {
    setAiCharMsg(null)
    setAiCharLoading(true)
    let newAvatarUrl = aiCharAvatarUrl

    if (aiCharNewFile) {
      const src = URL.createObjectURL(aiCharNewFile)
      const img = new Image()
      img.src = src
      await new Promise(resolve => { img.onload = resolve })
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 256
      const ctx = canvas.getContext('2d')!
      const scale = Math.max(256 / img.width, 256 / img.height)
      const w = img.width * scale, h = img.height * scale
      ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h)
      URL.revokeObjectURL(src)
      newAvatarUrl = canvas.toDataURL('image/jpeg', 0.85)
    }

    const trimmedName = aiCharName.trim() || 'Mako AI'
    const { error } = await supabase
      .from('ai_character')
      .update({ name: trimmedName, avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (error) {
      setAiCharMsg({ ok: false, text: 'Failed to save. Check permissions.' })
    } else {
      setAiCharMsg({ ok: true, text: 'AI Character updated!' })
      setAiCharAvatarUrl(newAvatarUrl)
      setAiCharName(trimmedName)
      setAiCharNewFile(null)
      setAiCharPreview(null)
    }
    setAiCharLoading(false)
  }

  // ── Banner file pick ──
  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setPremiumMsg({ ok: false, text: 'Banner must be under 10 MB.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setBannerSrc(reader.result as string)
      setBannerOffset({ x: 0, y: 0 })
      setBannerZoom(1)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Banner drag handlers ──
  const onBannerPD = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    bannerDragRef.current = { sx: e.clientX, sy: e.clientY, ox: bannerOffset.x, oy: bannerOffset.y }
  }
  const onBannerPM = (e: React.PointerEvent) => {
    if (!bannerDragRef.current) return
    setBannerOffset({
      x: bannerDragRef.current.ox + e.clientX - bannerDragRef.current.sx,
      y: bannerDragRef.current.oy + e.clientY - bannerDragRef.current.sy,
    })
  }
  const onBannerPU = () => { bannerDragRef.current = null }

  // ── Crop banner and upload ──
  const cropBannerAndUpload = async (): Promise<string | null> => {
    if (!bannerSrc) return null
    const img = new Image()
    img.src = bannerSrc
    await new Promise(r => { img.onload = r })

    const fitScale = Math.max(BANNER_W / img.naturalWidth, BANNER_H / img.naturalHeight)
    const fw = img.naturalWidth * fitScale
    const fh = img.naturalHeight * fitScale
    const fx = (BANNER_W - fw) / 2
    const fy = (BANNER_H - fh) / 2
    const sx = BANNER_OUT_W / BANNER_W
    const sy = BANNER_OUT_H / BANNER_H

    const canvas = document.createElement('canvas')
    canvas.width = BANNER_OUT_W; canvas.height = BANNER_OUT_H
    const ctx = canvas.getContext('2d')!

    const imgX = ((fx - BANNER_W / 2) * bannerZoom + BANNER_W / 2 + bannerOffset.x) * sx
    const imgY = ((fy - BANNER_H / 2) * bannerZoom + BANNER_H / 2 + bannerOffset.y) * sy
    ctx.drawImage(img, imgX, imgY, fw * bannerZoom * sx, fh * bannerZoom * sy)

    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        if (!blob) { resolve(null); return }

        // Delete old banner
        if (bannerUrl) {
          const oldPath = bannerUrl.split('/banners/')[1]?.split('?')[0]
          if (oldPath) await supabase.storage.from('banners').remove([oldPath])
        }

        const path = `${profile.id}/banner.jpg`
        const { error } = await supabase.storage
          .from('banners').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (error) { resolve(null); return }
        const { data } = supabase.storage.from('banners').getPublicUrl(path)
        resolve(`${data.publicUrl}?t=${Date.now()}`)
      }, 'image/jpeg', 0.92)
    })
  }

  // ── Save premium settings ──
  const savePremiumSettings = async () => {
    setPremiumLoading(true)
    setPremiumMsg(null)

    let newBannerUrl: string | null = null
    if (bannerSrc) {
      newBannerUrl = await cropBannerAndUpload()
      if (!newBannerUrl) {
        setPremiumMsg({ ok: false, text: 'Banner upload failed. Make sure the "banners" storage bucket exists.' })
        setPremiumLoading(false)
        return
      }
    }

    const patch: Partial<Profile> = {
      theme_enabled:         themeEnabled,
      card_enabled:          cardEnabled,
      theme_primary:         themePrimary,
      theme_secondary:       themeSecondary,
      card_primary:          cardPrimary,
      card_secondary:        cardSecondary,
      profile_tilt_enabled:  profileTiltEnabled,
      profile_bg_animation:  bgAnimEnabled ? bgAnimType : null,
      profile_bg_opacity:    bgAnimOpacity,
      profile_decoration:    decoration,
      profile_glow_enabled:  glowEnabled,
      profile_glow_color:    glowColor,
      profile_glow_opacity:  glowOpacity,
      animations_enabled:    animEnabled,
      anim_profile_fade:     animProfileFade,
      anim_chat_fade:        animChatFade,
      anim_gradient:         animGradient,
      anim_hover_glow:       animHoverGlow,
      anim_message_entrance: animMessageEntrance,
      anim_smooth_transitions: animSmoothTransitions,
      ...(newBannerUrl ? { banner_url: newBannerUrl } : {}),
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    if (error) {
      setPremiumMsg({ ok: false, text: 'Failed to save. Please try again.' })
    } else {
      if (newBannerUrl) setBannerUrl(newBannerUrl)
      setBannerSrc(null)
      if (themeEnabled) setTheme(themePrimary, themeSecondary)
      else resetTheme()
      setAnimations(buildAnimConfig())
      setPremiumMsg({ ok: true, text: 'Premium settings saved!' })
      onUpdated({ ...profile, ...patch, banner_url: newBannerUrl ?? profile.banner_url })
    }
    setPremiumLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="relative bg-[#2b2d31] rounded-xl w-full max-w-2xl shadow-2xl flex overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sidebar ── */}
        <div className="w-52 bg-[#232428] p-4 shrink-0 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#949ba4] mb-2 px-2">
            User Settings
          </p>
          {(['profile', 'account', ...(profile.is_admin ? ['admin'] : [])] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === 'admin' && !adminLoaded) loadAdminCodes() }}
              className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize mb-0.5 ${
                tab === t
                  ? 'bg-[#404249] text-[#dbdee1]'
                  : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
              } ${t === 'admin' ? 'text-red-400 hover:text-red-300' : ''}`}>
              {t === 'profile' ? 'Profile' : t === 'account' ? 'Account' : '⚙ Admin'}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-xl font-bold ${tab === 'admin' ? 'text-red-400' : 'text-[#dbdee1]'}`}>
              {tab === 'profile' ? 'Profile' : tab === 'account' ? 'Account' : 'Admin Panel'}
            </h2>
            <button onClick={onClose} className="text-[#949ba4] hover:text-[#dbdee1] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ══ Profile tab ══ */}
          {tab === 'profile' && (
            <div className="space-y-7">

              {/* Avatar */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">
                  Profile Picture
                </p>

                {alignerSrc ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[#949ba4]">Drag to reposition · use slider to zoom</p>
                    <div
                      className="relative mx-auto rounded-full overflow-hidden select-none"
                      style={{ width: CROP, height: CROP, background: '#111', cursor: dragRef.current ? 'grabbing' : 'grab' }}
                      onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
                    >
                      <img
                        src={alignerSrc} alt="" draggable={false}
                        style={{
                          width: CROP, height: CROP, objectFit: 'cover',
                          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                          pointerEvents: 'none', userSelect: 'none',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mx-auto" style={{ width: CROP }}>
                      <ZoomOut className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                      <input type="range" min={1} max={3} step={0.02} value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))} className="flex-1 accent-[#5865f2]" />
                      <ZoomIn className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                    </div>
                    <div style={{ width: CROP }} className="mx-auto">
                      <button onClick={() => setAlignerSrc(null)}
                        className="w-full text-xs py-1.5 text-[#949ba4] hover:text-[#dbdee1] border border-[#3f4147] rounded-md transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-[#383a40] flex items-center justify-center shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold select-none">
                          {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <button onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-md transition-colors">
                        <Upload className="w-4 h-4" />
                        Choose Photo
                      </button>
                      <p className="text-xs text-[#949ba4] mt-2">JPG, PNG or GIF · Max 5 MB</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  </div>
                )}
              </div>

              {/* Display name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">
                  Display Name
                </label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder={profile.username} maxLength={32}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm" />
                <p className="text-xs text-[#949ba4] mt-1.5">
                  This is how others see your name. Your tag stays as{' '}
                  <span className="font-mono text-[#dbdee1]">{userTag(profile)}</span>.
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">
                  About Me
                </label>
                <textarea value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="Tell others a bit about yourself…" maxLength={190} rows={4}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm resize-none" />
                <p className="text-xs text-[#949ba4] mt-1">{190 - bio.length} characters remaining</p>
              </div>

              {profileMsg && (
                <p className={`text-sm ${profileMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{profileMsg.text}</p>
              )}

              <button onClick={saveProfile} disabled={profileLoading}
                className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm">
                {profileLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* ══ Admin tab ══ */}
          {tab === 'admin' && profile.is_admin && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-red-400">Admin Panel</span>
              </div>

              {/* Generate code */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">
                  Generate Premium Code
                </p>
                <button onClick={generateCode} disabled={genLoading}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm flex items-center gap-2">
                  {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Code
                </button>
                {genMsg && (
                  <p className={`text-sm mt-2 font-mono ${genMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>
                    {genMsg.text}
                  </p>
                )}
              </div>

              {/* Code list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
                    All Codes (last 50)
                  </p>
                  <button onClick={loadAdminCodes} className="text-xs text-[#949ba4] hover:text-[#dbdee1] transition-colors">
                    Refresh
                  </button>
                </div>
                {adminCodes.length === 0 ? (
                  <p className="text-sm text-[#4e5058]">No codes yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {adminCodes.map(c => (
                      <div key={c.code} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md ${c.redeemed_by ? 'bg-[#1e1f22] opacity-50' : 'bg-[#1e1f22]'}`}>
                        <span className={`font-mono text-sm ${c.redeemed_by ? 'text-[#4e5058] line-through' : 'text-[#dbdee1]'}`}>
                          {c.code}
                        </span>
                        {c.redeemed_by ? (
                          <span className="text-xs text-[#4e5058] shrink-0">Redeemed</span>
                        ) : (
                          <button onClick={() => copyCode(c.code)}
                            className="text-xs text-[#5865f2] hover:text-[#7983f5] shrink-0 transition-colors font-medium">
                            {copiedCode === c.code ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ Account tab ══ */}
          {tab === 'account' && (
            <div className="space-y-6">

              {/* Tag */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-1">Your Tag</p>
                <p className="text-[#949ba4] text-sm mb-4">
                  Current: <span className="text-[#dbdee1] font-mono">{userTag(profile)}</span>
                </p>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">
                  New Tag (4 digits)
                </label>
                <div className="flex gap-2 items-center">
                  <span className="text-[#949ba4] font-semibold">{profile.username}#</span>
                  <input type="text" value={tag}
                    onChange={e => { setTag(e.target.value.replace(/\D/g, '').slice(0, 4)); setTagMsg(null) }}
                    placeholder="0001" maxLength={4}
                    className="w-24 bg-[#1e1f22] text-[#dbdee1] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] font-mono text-center" />
                </div>
                {tagMsg && (
                  <p className={`text-sm mt-2 ${tagMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{tagMsg.text}</p>
                )}
              </div>

              <button onClick={saveTag} disabled={tag.length !== 4 || tagLoading}
                className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm">
                {tagLoading ? 'Saving…' : 'Save Tag'}
              </button>

              {/* Divider */}
              <div className="border-t border-[#3f4147] pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-[#f0b132]" />
                  <p className="text-base font-bold text-[#f0b132]">Yasu Premium</p>
                  {isPremium && (
                    <img src="/ysu_premium.png" alt="Yasu Premium" className="h-5 w-auto ml-1" />
                  )}
                </div>

                {!isPremium ? (
                  /* ── Redeem code ── */
                  <div className="space-y-3">
                    <p className="text-sm text-[#949ba4]">
                      Enter a Yasu Premium code to unlock exclusive features.
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={codeInput}
                        onChange={e => { setCodeInput(e.target.value); setCodeMsg(null) }}
                        onKeyDown={e => e.key === 'Enter' && redeemCode()}
                        placeholder="Enter code…"
                        className="flex-1 bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#f0b132] text-sm font-mono" />
                      <button onClick={redeemCode} disabled={!codeInput.trim() || codeLoading}
                        className="px-4 py-2 bg-[#f0b132] hover:bg-[#d4982a] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-black font-semibold rounded-md transition-colors text-sm flex items-center gap-1.5">
                        {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Redeem
                      </button>
                    </div>
                    {codeMsg && (
                      <p className={`text-sm ${codeMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{codeMsg.text}</p>
                    )}
                  </div>
                ) : (
                  /* ── Premium settings ── */
                  <div className="space-y-6">
                    <p className="text-sm text-[#23a55a] font-medium">✓ Yasu Premium is active on your account.</p>

                    {/* Banner */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">Profile Banner</p>
                      {bannerSrc ? (
                        <div className="space-y-3">
                          <p className="text-xs text-[#949ba4]">Drag to reposition · use slider to zoom</p>
                          <div
                            className="relative mx-auto overflow-hidden rounded-md select-none"
                            style={{ width: BANNER_W, height: BANNER_H, background: '#111', cursor: bannerDragRef.current ? 'grabbing' : 'grab' }}
                            onPointerDown={onBannerPD} onPointerMove={onBannerPM} onPointerUp={onBannerPU} onPointerCancel={onBannerPU}
                          >
                            <img src={bannerSrc} alt="" draggable={false}
                              style={{
                                width: BANNER_W, height: BANNER_H, objectFit: 'cover',
                                transform: `translate(${bannerOffset.x}px, ${bannerOffset.y}px) scale(${bannerZoom})`,
                                transformOrigin: 'center center',
                                pointerEvents: 'none', userSelect: 'none',
                              }} />
                          </div>
                          <div className="flex items-center gap-2 mx-auto" style={{ width: BANNER_W }}>
                            <ZoomOut className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                            <input type="range" min={1} max={3} step={0.02} value={bannerZoom}
                              onChange={e => setBannerZoom(parseFloat(e.target.value))} className="flex-1 accent-[#f0b132]" />
                            <ZoomIn className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                          </div>
                          <div style={{ width: BANNER_W }} className="mx-auto">
                            <button onClick={() => setBannerSrc(null)}
                              className="w-full text-xs py-1.5 text-[#949ba4] hover:text-[#dbdee1] border border-[#3f4147] rounded-md transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-5">
                          <div className="rounded-md overflow-hidden bg-[#5865f2] shrink-0" style={{ width: 120, height: 32 }}>
                            {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <button onClick={() => bannerFileRef.current?.click()}
                              className="flex items-center gap-2 px-4 py-2 bg-[#f0b132] hover:bg-[#d4982a] text-black text-sm font-semibold rounded-md transition-colors">
                              <Upload className="w-4 h-4" />
                              {bannerUrl ? 'Change Banner' : 'Upload Banner'}
                            </button>
                            <p className="text-xs text-[#949ba4] mt-2">JPG or PNG · Max 10 MB</p>
                          </div>
                          <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFile} />
                        </div>
                      )}
                    </div>

                    {/* Interface theme colors */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">Interface Theme</p>
                        <button
                          type="button"
                          onClick={() => handleThemeToggle(!themeEnabled)}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${themeEnabled ? 'bg-[#23a55a]' : 'bg-[#4e5058]'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${themeEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      <div className={`flex gap-6 transition-opacity ${themeEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                          <p className="text-xs text-[#949ba4] mb-1.5">Primary</p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={themePrimary} onChange={e => setThemePrimary(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                            <span className="text-xs font-mono text-[#dbdee1]">{themePrimary}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-[#949ba4] mb-1.5">Secondary</p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={themeSecondary} onChange={e => setThemeSecondary(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                            <span className="text-xs font-mono text-[#dbdee1]">{themeSecondary}</span>
                          </div>
                        </div>
                        <div className="flex-1 h-8 rounded-md mt-6 self-end"
                          style={{ background: `linear-gradient(to right, ${themePrimary}, ${themeSecondary})` }} />
                      </div>
                    </div>

                    {/* Profile card colors */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">Profile Card Color</p>
                        <button
                          type="button"
                          onClick={() => setCardEnabled(v => !v)}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${cardEnabled ? 'bg-[#23a55a]' : 'bg-[#4e5058]'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${cardEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      <div className={`flex gap-6 transition-opacity ${cardEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                          <p className="text-xs text-[#949ba4] mb-1.5">Primary</p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={cardPrimary} onChange={e => setCardPrimary(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                            <span className="text-xs font-mono text-[#dbdee1]">{cardPrimary}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-[#949ba4] mb-1.5">Secondary</p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={cardSecondary} onChange={e => setCardSecondary(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                            <span className="text-xs font-mono text-[#dbdee1]">{cardSecondary}</span>
                          </div>
                        </div>
                        <div className="flex-1 h-8 rounded-md mt-6 self-end"
                          style={{ background: `linear-gradient(135deg, ${cardPrimary}, ${cardSecondary})` }} />
                      </div>
                    </div>

                    {/* Decorations */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">Decorations</p>
                      <div className="grid grid-cols-3 gap-2">
                        {/* None option */}
                        <button
                          type="button"
                          onClick={() => setDecoration(null)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            decoration === null
                              ? 'border-[#f0b132] bg-[#f0b132]/10'
                              : 'border-[#3f4147] bg-[#1e1f22] hover:border-[#5865f2]'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full bg-[#383a40] flex items-center justify-center">
                            <span className="text-[#949ba4] text-lg font-bold">✕</span>
                          </div>
                          <p className={`text-xs font-medium ${decoration === null ? 'text-[#f0b132]' : 'text-[#949ba4]'}`}>None</p>
                        </button>

                        {DECORATIONS.map(dec => (
                          <button
                            key={dec.id}
                            type="button"
                            onClick={() => setDecoration(dec.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                              decoration === dec.id
                                ? 'border-[#f0b132] bg-[#f0b132]/10'
                                : 'border-[#3f4147] bg-[#1e1f22] hover:border-[#5865f2]'
                            }`}
                          >
                            {/* Preview: avatar circle with decoration overlaid */}
                            <AvatarWithDecoration
                              displayInitial=""
                              size={48}
                              decoration={dec.id}
                              className="mx-auto"
                            />
                            <p className={`text-xs font-medium text-center leading-tight ${decoration === dec.id ? 'text-[#f0b132]' : 'text-[#949ba4]'}`}>{dec.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Public Profile */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">Public Profile</p>
                      <div className="bg-[#1e1f22] rounded-lg p-4 space-y-4">
                        {/* Profile Tilt */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm text-[#dbdee1] font-medium">Profile Tilt</p>
                            <p className="text-xs text-[#4e5058] mt-0.5 leading-relaxed">
                              Everyone who views your profile sees the 3D tilt effect when hovering
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setProfileTiltEnabled(v => !v)}
                            className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${profileTiltEnabled ? 'bg-[#f0b132]' : 'bg-[#4e5058]'}`}
                          >
                            <span className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${profileTiltEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[#2b2d31]" />

                        {/* Profile Glow */}
                        <div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm text-[#dbdee1] font-medium">Profile Glow</p>
                              <p className="text-xs text-[#4e5058] mt-0.5 leading-relaxed">
                                Adds a colored glow around your profile card border when others view it
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setGlowEnabled(v => !v)}
                              className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${glowEnabled ? 'bg-[#f0b132]' : 'bg-[#4e5058]'}`}
                            >
                              <span className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${glowEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          {glowEnabled && (
                            <div className="mt-3 bg-[#232428] rounded-lg p-3 space-y-3">
                              {/* Color picker */}
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-[#949ba4] font-medium">Glow Color</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-[#dbdee1]">{glowColor.toUpperCase()}</span>
                                  <input
                                    type="color"
                                    value={glowColor}
                                    onChange={e => setGlowColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                    style={{ WebkitAppearance: 'none' }}
                                  />
                                </div>
                              </div>
                              {/* Opacity slider */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-[#949ba4] font-medium">Glow Opacity</p>
                                  <span className="text-xs font-mono text-[#dbdee1]">{Math.round(glowOpacity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1}
                                  step={0.05}
                                  value={glowOpacity}
                                  onChange={e => setGlowOpacity(parseFloat(e.target.value))}
                                  className="w-full accent-[#f0b132]"
                                />
                              </div>
                              {/* Preview */}
                              <div className="flex justify-center pt-1">
                                <div
                                  className="w-24 h-14 rounded-lg"
                                  style={{ boxShadow: `0 0 20px 6px ${glowColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-[#2b2d31]" />

                        {/* Background Animations */}
                        <div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm text-[#dbdee1] font-medium">Background Animations</p>
                              <p className="text-xs text-[#4e5058] mt-0.5 leading-relaxed">
                                Plays an animation behind your profile card when others view it
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBgAnimEnabled(v => !v)}
                              className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${bgAnimEnabled ? 'bg-[#f0b132]' : 'bg-[#4e5058]'}`}
                            >
                              <span className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${bgAnimEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          {bgAnimEnabled && (
                            <div className="mt-3 space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  { id: 'shooting_stars', label: 'Shooting Stars', desc: 'Star field with a glowing moon and shooting streaks' },
                                  { id: 'snow',           label: 'Snow',           desc: 'Soft drifting snow particles' },
                                ] as { id: string; label: string; desc: string }[]).map(opt => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setBgAnimType(opt.id)}
                                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                                      bgAnimType === opt.id
                                        ? 'border-[#f0b132] bg-[#f0b132]/10'
                                        : 'border-[#3f4147] bg-[#232428] hover:border-[#5865f2]'
                                    }`}
                                  >
                                    <p className={`text-sm font-semibold ${bgAnimType === opt.id ? 'text-[#f0b132]' : 'text-[#dbdee1]'}`}>
                                      {opt.label}
                                    </p>
                                    <p className="text-xs text-[#4e5058] mt-0.5 leading-relaxed">{opt.desc}</p>
                                  </button>
                                ))}
                              </div>

                              {/* Opacity slider */}
                              <div className="bg-[#232428] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-[#949ba4] font-medium">Opacity</p>
                                  <span className="text-xs font-mono text-[#dbdee1]">{Math.round(bgAnimOpacity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1}
                                  step={0.05}
                                  value={bgAnimOpacity}
                                  onChange={e => setBgAnimOpacity(parseFloat(e.target.value))}
                                  className="w-full accent-[#f0b132]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Advanced Animations */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">Advanced Animations</p>
                          <p className="text-xs text-[#949ba4] mt-0.5">Enhanced visual effects and transitions</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !animEnabled
                            setAnimEnabled(next)
                            setAnimations(buildAnimConfig({ enabled: next }))
                          }}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${animEnabled ? 'bg-[#f0b132]' : 'bg-[#4e5058]'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${animEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {animEnabled && (
                        <div className="mt-3 bg-[#1e1f22] rounded-lg p-4 space-y-4">
                          {([
                            {
                              label: 'Better Profile View',
                              desc: 'Profile cards fade in on open and tilt in 3D as you move your cursor over them',
                              state: animProfileFade,
                              set: (v: boolean) => { setAnimProfileFade(v); setAnimations(buildAnimConfig({ profileFade: v })) },
                            },
                            {
                              label: 'Chat Fade In',
                              desc: 'Messages fade up into view as they appear',
                              state: animChatFade,
                              set: (v: boolean) => { setAnimChatFade(v); setAnimations(buildAnimConfig({ chatFade: v })) },
                            },
                            {
                              label: 'Moving Gradient',
                              desc: 'Interface background gradient slowly animates (requires Interface Theme)',
                              state: animGradient,
                              set: (v: boolean) => { setAnimGradient(v); setAnimations(buildAnimConfig({ gradient: v })) },
                            },
                            {
                              label: 'Hover Glow',
                              desc: 'Subtle blurple inner glow on messages when hovered',
                              state: animHoverGlow,
                              set: (v: boolean) => { setAnimHoverGlow(v); setAnimations(buildAnimConfig({ hoverGlow: v })) },
                            },
                            {
                              label: 'Message Entrance Slide',
                              desc: 'Messages slide in from the side when appearing',
                              state: animMessageEntrance,
                              set: (v: boolean) => { setAnimMessageEntrance(v); setAnimations(buildAnimConfig({ messageEntrance: v })) },
                            },
                            {
                              label: 'Smooth Transitions',
                              desc: 'Snappier, spring-based transitions throughout the interface',
                              state: animSmoothTransitions,
                              set: (v: boolean) => { setAnimSmoothTransitions(v); setAnimations(buildAnimConfig({ smoothTransitions: v })) },
                            },
                          ] as { label: string; desc: string; state: boolean; set: (v: boolean) => void }[]).map(({ label, desc, state, set }) => (
                            <div key={label} className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm text-[#dbdee1] font-medium">{label}</p>
                                <p className="text-xs text-[#4e5058] mt-0.5 leading-relaxed">{desc}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => set(!state)}
                                className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${state ? 'bg-[#f0b132]' : 'bg-[#4e5058]'}`}
                              >
                                <span className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${state ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {premiumMsg && (
                      <p className={`text-sm ${premiumMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{premiumMsg.text}</p>
                    )}

                  </div>
                )}
              </div>

              {/* ── AI Character ── */}
              <div className="border-t border-[#3f4147] pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-5 h-5 text-[#5865f2]" />
                  <p className="text-base font-bold text-[#dbdee1]">AI Character</p>
                </div>

                {!hasAiAccess ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#949ba4]">
                      Enter a character code to unlock the AI chatbot.
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={aiCodeInput}
                        onChange={e => { setAiCodeInput(e.target.value); setAiCodeMsg(null) }}
                        onKeyDown={e => e.key === 'Enter' && redeemAiCode()}
                        placeholder="Enter code…"
                        className="flex-1 bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm font-mono" />
                      <button onClick={redeemAiCode} disabled={!aiCodeInput.trim() || aiCodeLoading}
                        className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm flex items-center gap-1.5">
                        {aiCodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                        Redeem
                      </button>
                    </div>
                    {aiCodeMsg && (
                      <p className={`text-sm ${aiCodeMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{aiCodeMsg.text}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[#23a55a] font-medium">✓ AI Character is active on your account.</p>
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-[#dbdee1] font-medium">Hide AI chatbots</p>
                        <p className="text-xs text-[#4e5058] mt-0.5">Remove AI chatbots from your DMs list.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleHideAi(!hideAi)}
                        className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${hideAi ? 'bg-[#5865f2]' : 'bg-[#4e5058]'}`}
                      >
                        <span className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${hideAi ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Edit AI Character (mako#0000 only) ── */}
              {profile.username === 'mako' && profile.tag === '0000' && (
                <div className="border-t border-[#3f4147] pt-6">
                  <p className="text-base font-bold text-[#dbdee1] mb-4">Edit AI Character</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">Avatar</p>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#383a40] overflow-hidden flex items-center justify-center shrink-0">
                          {(aiCharPreview || aiCharAvatarUrl)
                            ? <img src={aiCharPreview ?? aiCharAvatarUrl!} alt="" className="w-full h-full object-cover" />
                            : <Bot className="w-6 h-6 text-[#949ba4]" />}
                        </div>
                        <button onClick={() => aiCharFileRef.current?.click()}
                          className="px-3 py-1.5 bg-[#383a40] hover:bg-[#404249] text-[#dbdee1] text-sm rounded-md transition-colors flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Change
                        </button>
                        <input ref={aiCharFileRef} type="file" accept="image/*" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setAiCharNewFile(f)
                            setAiCharPreview(URL.createObjectURL(f))
                          }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">Display Name</p>
                      <input type="text" value={aiCharName}
                        onChange={e => setAiCharName(e.target.value)}
                        maxLength={32}
                        placeholder="Mako AI"
                        className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm" />
                    </div>
                    {aiCharMsg && (
                      <p className={`text-sm ${aiCharMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>{aiCharMsg.text}</p>
                    )}
                    <button onClick={saveAiCharacter} disabled={aiCharLoading}
                      className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm flex items-center gap-2">
                      {aiCharLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save AI Character
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Floating save button ── */}
        <div className={`absolute bottom-6 right-6 transition-all duration-200 ${isDirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <button
            onClick={saveAll}
            disabled={saveAllLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#23a55a] hover:bg-[#1e9650] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xl transition-colors text-sm"
          >
            {saveAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
