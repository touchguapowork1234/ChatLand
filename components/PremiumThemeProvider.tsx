'use client'

import { createContext, useContext, useEffect } from 'react'
import type { Profile } from '@/lib/types'

const DEFAULT_PRIMARY   = '#2b2d31'
const DEFAULT_SECONDARY = '#2b2d31'

export type AnimConfig = {
  isPremium: boolean
  enabled: boolean
  profileFade: boolean
  chatFade: boolean
  gradient: boolean
  hoverGlow: boolean
  messageEntrance: boolean
  smoothTransitions: boolean
}

const ANIM_CLASSES = [
  'anim-profile-fade',
  'anim-chat-fade',
  'anim-gradient',
  'anim-hover-glow',
  'anim-message-entrance',
  'anim-smooth-transitions',
] as const

interface ThemeCtx {
  setTheme: (primary: string, secondary: string) => void
  resetTheme: () => void
  setAnimations: (cfg: AnimConfig) => void
  resetAnimations: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  setTheme: () => {},
  resetTheme: () => {},
  setAnimations: () => {},
  resetAnimations: () => {},
})

export const useTheme = () => useContext(ThemeContext)

function applyVars(primary: string, secondary: string) {
  const d = document.documentElement
  d.style.setProperty('--theme-primary',        primary)
  d.style.setProperty('--theme-secondary',       secondary)
  d.style.setProperty('--theme-overlay-rail',    'rgba(0,0,0,0.5)')
  d.style.setProperty('--theme-overlay-sidebar', 'rgba(0,0,0,0.35)')
  d.style.setProperty('--theme-active',          '1')
  d.style.setProperty('--theme-message-hover',   'rgba(255,255,255,0.06)')
}

function resetVars() {
  const d = document.documentElement
  d.style.setProperty('--theme-primary',        DEFAULT_PRIMARY)
  d.style.setProperty('--theme-secondary',       DEFAULT_SECONDARY)
  d.style.setProperty('--theme-overlay-rail',    'rgba(0,0,0,0)')
  d.style.setProperty('--theme-overlay-sidebar', 'rgba(0,0,0,0)')
  d.style.setProperty('--theme-active',          '0')
  d.style.setProperty('--theme-message-hover',   '#2e3035')
}

function applyAnimations(cfg: AnimConfig) {
  const html = document.documentElement
  const on = cfg.isPremium && cfg.enabled
  html.classList.toggle('anim-profile-fade',       !!(on && cfg.profileFade))
  html.classList.toggle('anim-chat-fade',          !!(on && cfg.chatFade))
  html.classList.toggle('anim-gradient',           !!(on && cfg.gradient))
  html.classList.toggle('anim-hover-glow',         !!(on && cfg.hoverGlow))
  html.classList.toggle('anim-message-entrance',   !!(on && cfg.messageEntrance))
  html.classList.toggle('anim-smooth-transitions', !!(on && cfg.smoothTransitions))
}

function resetAnimations() {
  const html = document.documentElement
  ANIM_CLASSES.forEach(c => html.classList.remove(c))
}

function profileToAnimConfig(p: Profile): AnimConfig {
  return {
    isPremium:        p.is_premium ?? false,
    enabled:          p.animations_enabled ?? false,
    profileFade:      p.anim_profile_fade ?? true,
    chatFade:         p.anim_chat_fade ?? true,
    gradient:         p.anim_gradient ?? true,
    hoverGlow:        p.anim_hover_glow ?? false,
    messageEntrance:  p.anim_message_entrance ?? true,
    smoothTransitions:p.anim_smooth_transitions ?? false,
  }
}

export default function PremiumThemeProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  useEffect(() => {
    if (profile.is_premium && profile.theme_primary && profile.theme_enabled === true) {
      applyVars(profile.theme_primary, profile.theme_secondary || profile.theme_primary)
    } else {
      resetVars()
    }
    applyAnimations(profileToAnimConfig(profile))
  }, [])

  return (
    <ThemeContext.Provider value={{
      setTheme: applyVars,
      resetTheme: resetVars,
      setAnimations: applyAnimations,
      resetAnimations,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
