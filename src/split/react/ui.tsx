import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'

/*
  Small building blocks, kept inside the module so it works on its own. Class names are
  prefixed "sp-" so they never clash with the host app's styles; colours come from the host's
  design tokens (Gillefeeling's names) with calm fallbacks in split.css.
*/

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button' }: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} className={`sp-btn sp-btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`sp-chip${selected ? ' is-on' : ''}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Bottom sheet on <dialog>: the browser handles focus, Escape and screen readers.
 * Focus starts on the title so iPhones don't pop the keyboard open just to look.
 */
export function Sheet({ open, title, onClose, children, foot }: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  foot?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sp-sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {open ? (
        <div className="sp-sheet-inner">
          <span className="sp-sheet-handle" aria-hidden="true" />
          <h2 className="sp-sheet-title" tabIndex={-1} ref={(el) => el?.setAttribute('autofocus', '')}>{title}</h2>
          <div className="sp-sheet-body">{children}</div>
          {foot ? <div className="sp-sheet-foot">{foot}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}

export function QrCode({ value, label }: { value: string; label: string }) {
  const { path, cells } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`
    return { path: d, cells: n + 8 }
  }, [value])
  // Always dark on white, in dark mode too: cameras read it best.
  return (
    <div className="sp-qr">
      <svg width="220" height="220" viewBox={`0 0 ${cells} ${cells}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <rect width={cells} height={cells} fill="#FFFFFF" />
        <path d={path} fill="#1A1A1A" />
      </svg>
    </div>
  )
}

/** Simple line icons (no icon font, no network). */
export function Icon({ name }: { name: 'plus' | 'people' | 'share' | 'more' | 'check' | 'back' | 'arrow' }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 14c2.4.2 4 1.8 4.5 4.5" /></>,
    share: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></>,
    more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    back: <path d="M15 5l-7 7 7 7" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  }
  return (
    <svg className="sp-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

/** First letter of a nickname for the little round badge. */
export function Initial({ name, id }: { name: string; id: string }) {
  const tint = (parseInt(id.slice(0, 2), 16) || 0) % 6
  return <span className={`sp-initial sp-tint-${tint}`} aria-hidden="true">{[...name.trim()][0]?.toUpperCase() ?? '?'}</span>
}
