/**
 * useIsDark
 * Reactive hook that returns true when the `dark` class is present on <html>.
 * Responds to theme changes made by ThemeToggle or GlobalCommandPalette.
 */
import { useEffect, useState } from 'react'

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'))
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
