import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/400-italic.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import './app.css'
import { App } from './App'

// Visit counter for Ellen's project board: one +1 per browser per Stockholm day, real address only.
// Nothing about the visitor is sent; the database keeps one number per day (api/visit.js, split_count_visit()).
;(function countVisit() {
  try {
    if (location.hostname !== 'split.ellenial.app') return
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date())
    if (localStorage.getItem('ellenial-split:counted') === day) return
    localStorage.setItem('ellenial-split:counted', day)
    if (navigator.sendBeacon) navigator.sendBeacon('/api/visit')
    else fetch('/api/visit', { method: 'POST', keepalive: true }).catch(() => {})
  } catch { /* private mode or storage off: skip counting rather than count every load */ }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
