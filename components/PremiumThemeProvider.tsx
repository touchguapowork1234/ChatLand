'use client'

import { createContext, useContext, useEffect } from 'react'
import type { Profile } from '@/lib/types'

const DEFAULT_PRIMARY   = '#2b2d31'
const DEFAULT_SECONDARY = '#2b2d31'

interface ThemeCtx {
  setTheme: (primary: string, secondary: string) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({ setTheme: () => {}, resetTheme: () => {} })

export const useTheme = () => useContext(ThemeContext)

function applyVars(primary: string, secondary: string) {
  const d = document.documentElement
  d.style.setProperty('--theme-primary',          primary)
  d.style.setProperty('--theme-secondary',         secondary)
  d.style.setProperty('--theme-overlay-rail',      'rgba(0,0,0,0.5)')
  d.style.setProperty('--theme-overlay-sidebar',   'rgba(0,0,0,0.35)')
  d.style.setProperty('--theme-active',            '1')
  d.style.setProperty('--theme-message-hover',     'rgba(255,255,255,0.06)')
}

function resetVars() {
  const d = document.documentElement
  d.style.setProperty('--theme-primary',          DEFAULT_PRIMARY)
  d.style.setProperty('--theme-secondary',         DEFAULT_SECONDARY)
  d.style.setProperty('--theme-overlay-rail',      'rgba(0,0,0,0)')
  d.style.setProperty('--theme-overlay-sidebar',   'rgba(0,0,0,0)')
  d.style.setProperty('--theme-active',            '0')
  d.style.setProperty('--theme-message-hover',     '#2e3035')
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
  }, [])

  return (
    <ThemeContext.Provider value={{ setTheme: applyVars, resetTheme: resetVars }}>
      {children}
    </ThemeContext.Provider>
  )
}
