'use client'

import { createContext, useContext, useEffect } from 'react'
import type { Profile } from '@/lib/types'

const DEFAULTS = { primary: '#2b2d31', secondary: '#2b2d31' }

interface ThemeCtx {
  setTheme: (primary: string, secondary: string) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({ setTheme: () => {}, resetTheme: () => {} })

export const useTheme = () => useContext(ThemeContext)

export default function PremiumThemeProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  useEffect(() => {
    if (profile.is_premium && profile.theme_primary && profile.theme_enabled !== false) {
      document.documentElement.style.setProperty('--theme-primary', profile.theme_primary)
      document.documentElement.style.setProperty('--theme-secondary', profile.theme_secondary || profile.theme_primary)
    }
  }, [])

  const setTheme = (primary: string, secondary: string) => {
    document.documentElement.style.setProperty('--theme-primary', primary)
    document.documentElement.style.setProperty('--theme-secondary', secondary)
  }

  const resetTheme = () => {
    document.documentElement.style.setProperty('--theme-primary', DEFAULTS.primary)
    document.documentElement.style.setProperty('--theme-secondary', DEFAULTS.secondary)
  }

  return (
    <ThemeContext.Provider value={{ setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
