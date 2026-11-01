import { useEffect, useRef } from 'react'
import { appCopy } from './copy'

/*
  Auto / Light / Dark, the shared Ellenial switch (public/ellenial-theme.js, copied unchanged from
  ellenial maps). That script owns the choice and saves it on this phone only; this just mounts its
  ready-made control. Auto follows the phone.
*/

type EllenialThemeApi = {
  control: (opts: { label?: string; autoHint?: string; separator?: string; labels?: { auto: string; light: string; dark: string } }) => HTMLElement
}

export function ThemeSwitch() {
  const host = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const api = (window as unknown as { EllenialTheme?: EllenialThemeApi }).EllenialTheme
    const el = host.current
    if (!api || !el) return
    const c = appCopy.theme
    const control = api.control({ label: c.label, autoHint: c.autoHint, separator: ' · ', labels: { auto: c.auto, light: c.light, dark: c.dark } })
    el.replaceChildren(control)
    return () => { el.replaceChildren() }
  }, [])
  return <span ref={host} />
}

/** A labelled row for settings lists (the room's More sheet). */
export function ThemeRow() {
  return (
    <div className="app-theme-row">
      <span className="sp-label">{appCopy.theme.label}</span>
      <ThemeSwitch />
    </div>
  )
}
