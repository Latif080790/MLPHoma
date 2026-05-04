/**
 * ThemeToggle.tsx
 * Tiny theme toggle using the "dark" class on documentElement (no external dependency).
 */

import React from "react"

/**
 * getInitialDark
 * Detect initial dark mode based on localStorage or system preference.
 */
function getInitialDark(): boolean {
  if (typeof window !== "undefined" && window.localStorage) {
    const stored = window.localStorage.getItem("theme")
    if (stored === "dark") return true
    if (stored === "light") return false
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  return false
}

/**
 * ThemeToggle
 * Toggle dark mode by adding/removing the "dark" class on <html>.
 * Persists preference to localStorage.
 */
export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean>(getInitialDark)

  React.useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setDark((d) => !d)}
      className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {dark ? "Light" : "Dark"}
    </button>
  )
}

export default ThemeToggle
