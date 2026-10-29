import { useState } from 'react'
import type { Transfer } from '../core/settle'
import { todayLocal, type RoomState } from '../core/model'
import { saveEntry, setSettled, type OpenRoom } from '../data/room'
import { useMoney, useSplit } from './context'
import { Button, Icon, Initial, Sheet } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  room: OpenRoom
  state: RoomState
  myId: string
  transfers: Transfer[]
  onSaved: () => void
}

/*
  Only YOUR transfers are listed (Brand Principles: nobody is exposed as the one who owes
  the most). Others are summed up as a count. Either side can record a transfer as done.
*/
export function SettleSheet({ open, onClose, room, state, myId, transfers, onSaved }: Props) {
  const { backend, copy } = useSplit()
  const c = copy.settle
  const money = useMoney(state.info!.data.currency)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const mine = transfers.filter((t) => t.from === myId || t.to === myId)
  const others = transfers.length - mine.length
  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.data.name ?? '?'

  async function record(t: Transfer) {
    const key = `${t.from}>${t.to}`
    setBusy(key)
    setError(false)
    try {
      await saveEntry(backend, room, crypto.randomUUID(), { kind: 'payment', v: 1, from: t.from, to: t.to, amount: t.amount, date: todayLocal() })
      onSaved()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  async function settle(on: boolean) {
    setBusy('room')
    setError(false)
    try {
      await setSettled(backend, room, on)
      onSaved()
      if (on) onClose()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} title={c.title} onClose={onClose}
      foot={
        <>
          {error ? <p className="sp-error" role="alert">{copy.expense.errors.generic}</p> : null}
          {state.settledAt
            ? <Button variant="secondary" onClick={() => settle(false)} disabled={busy === 'room'}>{c.unsettle}</Button>
            : <Button variant={transfers.length ? 'secondary' : 'primary'} onClick={() => settle(true)} disabled={busy === 'room'}>{c.markSettled}</Button>}
          <p className="sp-hint sp-center">{c.markSettledSub}</p>
        </>
      }>
      {transfers.length === 0 ? (
        <p className="sp-settle-empty">{c.allSquare}</p>
      ) : (
        <>
          <p className="sp-muted">{c.lead}</p>
          <h3 className="sp-label">{c.yourTransfers}</h3>
          {mine.length === 0 ? <p className="sp-settle-empty">{c.nothingForYou}</p> : (
            <ul className="sp-transfers">
              {mine.map((t) => {
                const other = t.from === myId ? t.to : t.from
                const sending = t.from === myId
                return (
                  <li key={`${t.from}>${t.to}`} className="sp-transfer">
                    <Initial name={nameOf(other)} id={other} />
                    <div className="sp-transfer-text">
                      <span>{sending ? c.send(nameOf(other)) : c.receive(nameOf(other))}</span>
                      <strong>{money(t.amount)}</strong>
                    </div>
                    <button type="button" className="sp-mini-btn" onClick={() => record(t)} disabled={busy === `${t.from}>${t.to}`}>
                      <Icon name="check" />{sending ? c.iSent : c.gotIt}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="sp-hint">{c.others(others)}</p>
          <details className="sp-details">
            <summary>{copy.more.privacy}</summary>
            <p>{c.honest}</p>
          </details>
        </>
      )}
    </Sheet>
  )
}
