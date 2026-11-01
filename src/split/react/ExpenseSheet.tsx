import { useEffect, useState } from 'react'
import { amountToInput, parseAmount } from '../core/money'
import { shareOut } from '../core/balances'
import { todayLocal, type Entry, type Expense, type RoomState, type Split } from '../core/model'
import { deleteEntry, saveEntry, type OpenRoom } from '../data/room'
import { SplitError } from '../data/backend'
import { useMoney, useSplit } from './context'
import { Button, Chip, Icon, Sheet } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  room: OpenRoom
  state: RoomState
  myId: string
  editing: Entry<Expense> | null
  onSaved: () => void
}

/*
  Add or edit one expense. The usual case is three taps and a number: amount, what for,
  save (paid by you, split equally between everyone).
*/
export function ExpenseSheet({ open, onClose, room, state, myId, editing, onSaved }: Props) {
  const { backend, copy } = useSplit()
  const c = copy.expense
  const money = useMoney(state.info!.data.currency)
  const people = state.members
  const allIds = people.map((p) => p.id)

  const [amountText, setAmountText] = useState('')
  const [title, setTitle] = useState('')
  const [paidBy, setPaidBy] = useState(myId)
  const [mode, setMode] = useState<'equal' | 'exact'>('equal')
  const [among, setAmong] = useState<string[]>(allIds)
  const [exact, setExact] = useState<Record<string, string>>({})
  const [date, setDate] = useState(todayLocal())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Fill the form each time the sheet opens.
  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(false)
    if (editing) {
      const d = editing.data
      setAmountText(amountToInput(d.amount))
      setTitle(d.title)
      setPaidBy(d.paidBy)
      setDate(d.date)
      if (d.split.mode === 'exact') {
        setMode('exact')
        setExact(Object.fromEntries(Object.entries(d.split.amounts).map(([id, n]) => [id, amountToInput(n)])))
        setAmong(allIds)
      } else {
        setMode('equal')
        // Shares (from a future version) show as an equal split between the same people.
        setAmong(d.split.mode === 'equal' ? d.split.among : Object.keys(d.split.shares))
        setExact({})
      }
    } else {
      setAmountText('')
      setTitle('')
      setPaidBy(myId)
      setMode('equal')
      setAmong(allIds)
      setExact({})
      setDate(todayLocal())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id])

  const amount = parseAmount(amountText)
  const exactSum = Object.values(exact).reduce((s, t) => s + (t.trim() ? parseAmount(t) ?? NaN : 0), 0)
  const known = new Set(allIds)
  const eachLabel = (() => {
    if (!amount || mode !== 'equal' || !among.length) return null
    const shares = shareOut(amount, { mode: 'equal', among }, known)
    if (!shares) return null
    const vals = [...shares.values()]
    return c.eachPays(money(Math.max(...vals)))
  })()

  function toggle(id: string) {
    setAmong((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  async function save() {
    if (!amount) return setError(c.errors.amount)
    const what = title.trim()
    if (!what) return setError(c.errors.what)
    let split: Split
    if (mode === 'equal') {
      const ids = among.filter((id) => known.has(id))
      if (!ids.length) return setError(c.errors.nobody)
      split = { mode: 'equal', among: ids }
    } else {
      const amounts: Record<string, number> = {}
      for (const [id, t] of Object.entries(exact)) {
        if (!t.trim() || !known.has(id)) continue
        const n = parseAmount(t)
        if (n === null) return setError(c.errors.custom)
        amounts[id] = n
      }
      if (Object.values(amounts).reduce((a, b) => a + b, 0) !== amount) return setError(c.errors.custom)
      split = { mode: 'exact', amounts }
    }
    const data: Expense = { kind: 'expense', v: 1, title: what, amount, paidBy, split, date, addedBy: editing?.data.addedBy ?? myId }
    setSaving(true)
    setError(null)
    try {
      await saveEntry(backend, room, editing?.id ?? crypto.randomUUID(), data, editing?.revision)
      onSaved()
      onClose()
    } catch (e) {
      const code = e instanceof SplitError ? e.code : 'network'
      if (code === 'edit_conflict') { onSaved(); setError(c.errors.conflict) }
      else setError(code === 'room_full' ? c.errors.full : c.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    setSaving(true)
    try {
      await deleteEntry(backend, room, editing.id)
      onSaved()
      onClose()
    } catch {
      setError(c.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  const nameOf = (id: string) => (id === myId ? copy.common.youCap : people.find((p) => p.id === id)?.data.name ?? '?')

  if (confirmDelete) {
    return (
      <Sheet open={open} title={c.deleteConfirm} onClose={() => setConfirmDelete(false)}
        foot={<><Button variant="danger" onClick={remove} disabled={saving}>{copy.common.delete}</Button><Button variant="quiet" onClick={() => setConfirmDelete(false)}>{copy.common.cancel}</Button></>}>
        <p className="sp-muted">{c.deleteSub}</p>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      title={editing ? c.editTitle : c.addTitle}
      onClose={onClose}
      foot={
        <>
          {error ? <p className="sp-error" role="alert">{error}</p> : null}
          <Button onClick={save} disabled={saving}>{copy.common.save}</Button>
          {editing ? <Button variant="quiet" onClick={() => setConfirmDelete(true)}>{copy.common.delete}</Button> : null}
        </>
      }
    >
      <label className="sp-amount">
        <span className="sp-label">{c.amount}</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          aria-invalid={!!amountText && !amount}
          aria-describedby={amountText && !amount ? 'sp-amount-hint' : undefined}
        />
        <span className="sp-amount-cur">{state.info!.data.currency}</span>
        {/* words, not just a changed line colour */}
        {amountText && !amount ? <span id="sp-amount-hint" className="sp-amount-hint">{c.errors.amount}</span> : null}
      </label>

      <label className="sp-field">
        <span className="sp-label">{c.what}</span>
        <input value={title} maxLength={80} placeholder={c.whatPlaceholder} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <div className="sp-field">
        <span className="sp-label">{c.paidBy}</span>
        <div className="sp-chips">
          {people.map((p) => (
            <Chip key={p.id} selected={paidBy === p.id} onClick={() => setPaidBy(p.id)}>{nameOf(p.id)}</Chip>
          ))}
        </div>
      </div>

      <div className="sp-field">
        <div className="sp-switch" role="radiogroup" aria-label={c.splitHow}>
          <button type="button" role="radio" aria-checked={mode === 'equal'} className={mode === 'equal' ? 'is-on' : ''} onClick={() => setMode('equal')}>{mode === 'equal' ? <Icon name="check" /> : null}{c.equally}</button>
          <button type="button" role="radio" aria-checked={mode === 'exact'} className={mode === 'exact' ? 'is-on' : ''} onClick={() => setMode('exact')}>{mode === 'exact' ? <Icon name="check" /> : null}{c.custom}</button>
        </div>
        {mode === 'equal' ? (
          <>
            <div className="sp-chips">
              {people.map((p) => (
                <Chip key={p.id} selected={among.includes(p.id)} onClick={() => toggle(p.id)}>{nameOf(p.id)}</Chip>
              ))}
            </div>
            {eachLabel ? <p className="sp-hint">{eachLabel}</p> : null}
          </>
        ) : (
          <>
            <div className="sp-exact">
              {people.map((p) => (
                <label key={p.id} className="sp-exact-row">
                  <span>{nameOf(p.id)}</span>
                  <input inputMode="decimal" placeholder="0" value={exact[p.id] ?? ''} onChange={(e) => setExact((x) => ({ ...x, [p.id]: e.target.value }))} />
                </label>
              ))}
            </div>
            {amount ? (
              <p className="sp-hint">
                {Number.isNaN(exactSum) ? c.errors.custom
                  : exactSum === amount ? c.allPlaced
                  : exactSum < amount ? c.left(money(amount - exactSum))
                  : c.over(money(exactSum - amount))}
              </p>
            ) : null}
          </>
        )}
      </div>

      <label className="sp-field sp-field-inline">
        <span className="sp-label">{c.date}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
    </Sheet>
  )
}
