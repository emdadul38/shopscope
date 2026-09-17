import { useEffect } from 'react'
import type { UserPreferences } from '../types/page'

function setDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

export function useApplyTheme(theme: UserPreferences['theme']) {
  useEffect(() => {
    if (theme !== 'system') {
      setDarkClass(theme === 'dark')
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkClass(media.matches)

    const onChange = (e: MediaQueryListEvent) => setDarkClass(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])
}
