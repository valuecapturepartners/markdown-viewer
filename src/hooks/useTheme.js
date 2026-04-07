import { useState, useEffect } from 'react'

const STORAGE_KEY = 'vcp_theme'

function applyTheme(dark) {
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'dark'
  })

  useEffect(() => {
    applyTheme(dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }, [dark])

  // Apply on first render (before any React paint)
  useEffect(() => { applyTheme(dark) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return [dark, setDark]
}
