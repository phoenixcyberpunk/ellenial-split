import { useState } from 'react'
import { Button, Chip, CURRENCIES, Icon, LIMITS, SplitError, createRoom, rememberRoom, useSplit, type Currency } from '../split'
import { appCopy } from './copy'

/** Guess a currency from the phone's region; people can change it. */
function guessCurrency(): Currency {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
  const map: Record<string, Currency> = { SE: 'SEK', NO: 'NOK', DK: 'DKK', US: 'USD', GB: 'GBP' }
  if (map[region]) return map[region]
  return ['DE', 'FR', 'NL', 'FI', 'ES', 'IT', 'AT', 'BE', 'IE', 'PT'].includes(region) ? 'EUR' : 'SEK'
}

export function CreateRoom({ onBack, onCreated }: { onBack: () => void; onCreated: (roomId: string, secret: string) => void }) {
  const { backend } = useSplit()
  const c = appCopy.create
  const [name, setName] = useState('')
  const [myName, setMyName] = useState('')
  const [currency, setCurrency] = useState<Currency>(guessCurrency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return setError(c.errors.name)
    if (!myName.trim()) return setError(c.errors.myName)
    setBusy(true)
    setError(null)
    try {
      const { room, myId } = await createRoom(backend, { name: name.trim(), currency, myName: myName.trim() })
      rememberRoom({ roomId: room.roomId, secret: room.keys.secret, name: name.trim(), myId })
      onCreated(room.roomId, room.keys.secret)
    } catch (e) {
      setError(e instanceof SplitError && e.code === 'rate_limited' ? c.errors.rate : c.errors.generic)
      setBusy(false)
    }
  }

  return (
    <form className="sp-screen" onSubmit={(e) => { e.preventDefault(); void create() }}>
      <header className="sp-top">
        <button type="button" className="sp-icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" /></button>
      </header>
      <h1 className="sp-title">{c.title}</h1>
      <label className="sp-field">
        <span className="sp-label">{c.roomName}</span>
        <input value={name} maxLength={LIMITS.roomName} placeholder={c.roomPlaceholder} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="sp-field">
        <span className="sp-label">{c.myName}</span>
        <input value={myName} maxLength={LIMITS.memberName} placeholder={c.myNamePlaceholder} onChange={(e) => setMyName(e.target.value)} autoComplete="nickname" />
      </label>
      <div className="sp-field">
        <span className="sp-label">{c.currency}</span>
        <div className="sp-chips">
          {CURRENCIES.map((cur) => <Chip key={cur} selected={currency === cur} onClick={() => setCurrency(cur)}>{cur}</Chip>)}
        </div>
      </div>
      {error ? <p className="sp-error" role="alert">{error}</p> : null}
      <div className="sp-dock">
        <Button type="submit" disabled={busy}>{c.create}</Button>
      </div>
    </form>
  )
}
