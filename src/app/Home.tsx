import { useState } from 'react'
import { Button, Icon, readRoomRef, rememberedRooms, type RoomRef } from '../split'
import { appCopy } from './copy'
import { config } from './config'
import { Logo } from './Logo'

export function Home({ badLink, onNew, onOpen }: { badLink: boolean; onNew: () => void; onOpen: (ref: RoomRef) => void }) {
  const c = appCopy.home
  const rooms = rememberedRooms()
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState(badLink)

  function open() {
    const ref = readRoomRef(paste)
    if (ref) onOpen(ref)
    else setPasteError(true)
  }

  return (
    <div className="sp-screen app-home">
      <header className="app-hero">
        <Logo />
        <h1 className="sp-title">{c.title}</h1>
        <p className="sp-muted">{c.lead}</p>
      </header>

      <ul className="app-promises">
        {c.promises.map((p) => <li key={p}><Icon name="check" />{p}</li>)}
      </ul>

      {rooms.length ? (
        <section className="sp-stack">
          <h2 className="sp-label">{c.yourRooms}</h2>
          <ul className="sp-pick">
            {rooms.map((r) => (
              <li key={r.roomId}>
                <button type="button" className="sp-pick-row" onClick={() => onOpen({ roomId: r.roomId, secret: r.secret })}>
                  <span className="app-room-dot" aria-hidden="true" />
                  <span>{r.name ?? '…'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="sp-details" open={pasteError}>
        <summary>{c.paste}</summary>
        <form className="sp-inline-form app-paste" onSubmit={(e) => { e.preventDefault(); open() }}>
          <input value={paste} placeholder={c.pastePlaceholder} onChange={(e) => { setPaste(e.target.value); setPasteError(false) }} aria-label={c.pastePlaceholder} />
          <button type="submit" className="sp-mini-btn">{c.open}</button>
        </form>
        {pasteError ? <p className="sp-hint">{c.badLink}</p> : null}
      </details>

      <footer className="app-footer">
        <a href={config.brandUrl}>{appCopy.footer.by}</a> · <a href={config.repoUrl}>{appCopy.footer.source}</a>
      </footer>

      <div className="sp-dock">
        <Button onClick={onNew}><Icon name="plus" /> {c.start}</Button>
      </div>
    </div>
  )
}
