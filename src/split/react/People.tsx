import { useState } from 'react'
import { LIMITS, type RoomState } from '../core/model'
import { saveEntry, type OpenRoom } from '../data/room'
import { useSplit } from './context'
import { Button, Initial, Sheet } from './ui'

/** First visit on this phone: pick your name from the list, or add yourself. One or two taps. */
export function WhoAreYou({ room, state, onPicked, onReload }: {
  room: OpenRoom
  state: RoomState
  onPicked: (id: string) => void
  onReload: () => void
}) {
  const { backend, copy } = useSplit()
  const c = copy.join
  const [adding, setAdding] = useState(state.members.length === 0)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function join() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError(false)
    try {
      const id = crypto.randomUUID()
      await saveEntry(backend, room, id, { kind: 'member', v: 1, name: n })
      onPicked(id)
      onReload()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sp-screen sp-join">
      <p className="sp-eyebrow">{state.info?.data.name}</p>
      <h1 className="sp-title">{c.title}</h1>
      <p className="sp-muted">{c.lead}</p>
      {!adding ? (
        <>
          <ul className="sp-pick">
            {state.members.map((m) => (
              <li key={m.id}>
                <button type="button" className="sp-pick-row" onClick={() => onPicked(m.id)}>
                  <Initial name={m.data.name} id={m.id} />
                  <span>{m.data.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setAdding(true)}>{c.newPerson}</Button>
        </>
      ) : (
        <form className="sp-stack" onSubmit={(e) => { e.preventDefault(); void join() }}>
          <label className="sp-field">
            <span className="sp-label">{c.nicknameLabel}</span>
            <input value={name} maxLength={LIMITS.memberName} placeholder={c.nicknamePlaceholder} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          </label>
          {error ? <p className="sp-error" role="alert">{copy.expense.errors.generic}</p> : null}
          <Button type="submit" disabled={busy || !name.trim()}>{c.joinNew}</Button>
          {state.members.length ? <Button variant="quiet" onClick={() => setAdding(false)}>{copy.common.back}</Button> : null}
        </form>
      )}
      <p className="sp-hint sp-center">{c.privacy}</p>
    </div>
  )
}

/** Everyone in the room. Add friends who haven't opened the link yet; change your own nickname. */
export function PeopleSheet({ open, onClose, room, state, myId, onSaved, onSwitchMe }: {
  open: boolean
  onClose: () => void
  room: OpenRoom
  state: RoomState
  myId: string
  onSaved: () => void
  onSwitchMe: () => void
}) {
  const { backend, copy } = useSplit()
  const c = copy.people
  const me = state.members.find((m) => m.id === myId)
  const [newName, setNewName] = useState('')
  const [myName, setMyName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const n = newName.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    try {
      await saveEntry(backend, room, crypto.randomUUID(), { kind: 'member', v: 1, name: n })
      setNewName('')
      onSaved()
    } catch {
      setError(copy.expense.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function rename() {
    const n = myName?.trim()
    if (!n || !me) return
    setBusy(true)
    setError(null)
    try {
      await saveEntry(backend, room, me.id, { kind: 'member', v: 1, name: n }, me.revision)
      setMyName(null)
      onSaved()
    } catch {
      onSaved()
      setError(copy.expense.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title={c.title} onClose={onClose} foot={<Button variant="quiet" onClick={onClose}>{copy.common.done}</Button>}>
      <ul className="sp-people">
        {state.members.map((m) => (
          <li key={m.id} className="sp-person">
            <Initial name={m.data.name} id={m.id} />
            {m.id === myId && myName !== null ? (
              <form className="sp-inline-form" onSubmit={(e) => { e.preventDefault(); void rename() }}>
                <input value={myName} maxLength={LIMITS.memberName} onChange={(e) => setMyName(e.target.value)} aria-label={c.rename} autoFocus />
                <button type="submit" className="sp-mini-btn" disabled={busy}>{copy.common.save}</button>
              </form>
            ) : (
              <>
                <span className="sp-person-name">{m.data.name}{m.id === myId ? <em> · {c.thisIsYou}</em> : null}</span>
                {m.id === myId ? <button type="button" className="sp-link" onClick={() => setMyName(m.data.name)}>{c.rename}</button> : null}
              </>
            )}
          </li>
        ))}
      </ul>
      {state.members.length < LIMITS.maxPeople ? (
        <form className="sp-inline-form" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <input value={newName} maxLength={LIMITS.memberName} placeholder={c.nicknamePlaceholder} onChange={(e) => setNewName(e.target.value)} aria-label={c.add} />
          <button type="submit" className="sp-mini-btn" disabled={busy || !newName.trim()}>{c.add}</button>
        </form>
      ) : null}
      <p className="sp-hint">{c.addHint}</p>
      {error ? <p className="sp-error" role="alert">{error}</p> : null}
      <button type="button" className="sp-link" onClick={onSwitchMe}>{c.switchMe}</button>
    </Sheet>
  )
}
