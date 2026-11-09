// The app icon (Ellen's drawing, the same as on the home screen) beside the small "Ellenial" and the name,
// like the other Ellenial apps (9 Nov 2026).
export function Logo() {
  return (
    <p className="app-logo" aria-hidden="true">
      <img className="app-logo__icon" src="/icon-192.png" alt="" width={44} height={44} />
      <span className="app-logo__name"><span className="ellenial-eyebrow">Ellenial</span><span className="app-logo__word">Split<span>.</span></span></span>
    </p>
  )
}
