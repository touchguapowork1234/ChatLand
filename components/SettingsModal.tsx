'use client'

import { useRef, useState } from 'react'
import { X, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { userTag } from '@/lib/types'

type Tab = 'profile' | 'account'

interface Props {
  profile: Profile
  onClose: () => void
  onUpdated: (updated: Profile) => void
}

const CROP = 160  // viewfinder px
const OUT  = 256  // canvas output px

export default function SettingsModal({ profile, onClose, onUpdated }: Props) {
  const supabase = createClient()
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

  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  // ── Account tab ──
  const [tag, setTag]           = useState(profile.tag)
  const [tagLoading, setTagLoading] = useState(false)
  const [tagMsg, setTagMsg]     = useState<{ ok: boolean; text: string } | null>(null)

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
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  // ── Drag handlers ──
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

  // ── Canvas crop → Supabase upload ──
  const cropAndUpload = async (): Promise<string | null> => {
    if (!alignerSrc) return null
    const img = new Image()
    img.src = alignerSrc
    await new Promise(r => { img.onload = r })

    // Replicate CSS objectFit:cover + transform
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
        setProfileMsg({ ok: false, text: 'Avatar upload failed. Make sure the "avatars" storage bucket exists in Supabase.' })
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#2b2d31] rounded-xl w-full max-w-2xl shadow-2xl flex overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sidebar ── */}
        <div className="w-52 bg-[#232428] p-4 shrink-0 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#949ba4] mb-2 px-2">
            User Settings
          </p>
          {(['profile', 'account'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize mb-0.5 ${
                tab === t
                  ? 'bg-[#404249] text-[#dbdee1]'
                  : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}>
              {t === 'profile' ? 'Profile' : 'Account'}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#dbdee1]">
              {tab === 'profile' ? 'Profile' : 'Account'}
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
                  /* ── Alignment tool ── */
                  <div className="space-y-3">
                    <p className="text-xs text-[#949ba4]">
                      Drag to reposition · use slider to zoom
                    </p>

                    {/* Circular crop frame */}
                    <div
                      className="relative mx-auto rounded-full overflow-hidden select-none"
                      style={{
                        width: CROP, height: CROP,
                        background: '#111',
                        cursor: dragRef.current ? 'grabbing' : 'grab',
                      }}
                      onPointerDown={onPD}
                      onPointerMove={onPM}
                      onPointerUp={onPU}
                      onPointerCancel={onPU}
                    >
                      <img
                        src={alignerSrc}
                        alt=""
                        draggable={false}
                        style={{
                          width: CROP, height: CROP,
                          objectFit: 'cover',
                          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                      />
                    </div>

                    {/* Zoom slider */}
                    <div className="flex items-center gap-2 mx-auto" style={{ width: CROP }}>
                      <ZoomOut className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                      <input
                        type="range" min={1} max={3} step={0.02} value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))}
                        className="flex-1 accent-[#5865f2]"
                      />
                      <ZoomIn className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
                    </div>

                    {/* Cancel aligner */}
                    <div style={{ width: CROP }} className="mx-auto">
                      <button
                        onClick={() => setAlignerSrc(null)}
                        className="w-full text-xs py-1.5 text-[#949ba4] hover:text-[#dbdee1] border border-[#3f4147] rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Avatar preview + upload ── */
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-[#5865f2] flex items-center justify-center shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold select-none">
                          {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-md transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Choose Photo
                      </button>
                      <p className="text-xs text-[#949ba4] mt-2">JPG, PNG or GIF · Max 5 MB</p>
                    </div>
                    <input
                      ref={fileRef} type="file" accept="image/*"
                      className="hidden" onChange={handleFile}
                    />
                  </div>
                )}
              </div>

              {/* Display name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={profile.username}
                  maxLength={32}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm"
                />
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
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell others a bit about yourself…"
                  maxLength={190}
                  rows={4}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#4e5058] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] text-sm resize-none"
                />
                <p className="text-xs text-[#949ba4] mt-1">{190 - bio.length} characters remaining</p>
              </div>

              {profileMsg && (
                <p className={`text-sm ${profileMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>
                  {profileMsg.text}
                </p>
              )}

              <button
                onClick={saveProfile}
                disabled={profileLoading}
                className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm"
              >
                {profileLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* ══ Account tab ══ */}
          {tab === 'account' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-1">
                  Your Tag
                </p>
                <p className="text-[#949ba4] text-sm mb-4">
                  Current:{' '}
                  <span className="text-[#dbdee1] font-mono">{userTag(profile)}</span>
                </p>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">
                  New Tag (4 digits)
                </label>
                <div className="flex gap-2 items-center">
                  <span className="text-[#949ba4] font-semibold">{profile.username}#</span>
                  <input
                    type="text"
                    value={tag}
                    onChange={e => { setTag(e.target.value.replace(/\D/g, '').slice(0, 4)); setTagMsg(null) }}
                    placeholder="0001"
                    maxLength={4}
                    className="w-24 bg-[#1e1f22] text-[#dbdee1] px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-[#5865f2] font-mono text-center"
                  />
                </div>
                {tagMsg && (
                  <p className={`text-sm mt-2 ${tagMsg.ok ? 'text-[#23a55a]' : 'text-red-400'}`}>
                    {tagMsg.text}
                  </p>
                )}
              </div>

              <button
                onClick={saveTag}
                disabled={tag.length !== 4 || tagLoading}
                className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4e5058] disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors text-sm"
              >
                {tagLoading ? 'Saving…' : 'Save Tag'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
