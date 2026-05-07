'use client'

import { createContext, useContext, useEffect } from 'react'
import type { Profile } from '@/lib/types'

interface ThemeCtx {
  setTheme: (primary: string, secondary: string) => void
}

const ThemeContext = createContext<ThemeCtx>({ setTheme: () => {} })

export const useTheme = () => useContext(ThemeContext)

export default function PremiumThemeProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  useEffect(() => {
    if (profile.is_premium && profile.theme_primary) {
      document.documentElement.style.setProperty('--theme-primary', profile.theme_primary)
      document.documentElement.style.setProperty('--theme-secondary', profile.theme_secondary || profile.theme_primary)
    }
  }, [])

  const setTheme = (primary: string, secondary: string) => {
    document.documentElement.style.setProperty('--theme-primary', primary)
    document.documentElement.style.setProperty('--theme-secondary', secondary)
  }

  return <ThemeContext.Provider value={{ setTheme }}>{children}</ThemeContext.Provider>
}
