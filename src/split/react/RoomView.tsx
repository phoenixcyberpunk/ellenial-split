import { useEffect, useMemo, useState } from 'react'
import { computeBalances, shareOut } from '../core/balances'
import { settleUp } from '../core/settle'
import type { Entry, Expense, Payment } from '../core/model'
import { deleteEntry, setSettled, type OpenRoom } from '../data/room'
import { formatDay, useMoney, useSplit } from './context'
import { useRoom } from './useRoom'
import { Button, Icon, Initial, Sheet as BottomSheet } from './ui'
import { ExpenseSheet } from './ExpenseSheet'
import { SettleSheet } from './SettleSheet'
import { PeopleSheet, WhoAreYou } from './People'
import { InviteSheet, MoreSheet } from './RoomSheets'

export type RoomViewProps = {
  room: OpenRoom
  /** The shareable link for this room (host decides the domain). */
  link: string
  /** Which person this phone is, or null if not picked yet. */
  myId: string | null
  onMyId: (id: string | null) => void
  /** Leave the room screen (back to the host's home). */
  onExit: () => void
  /** The room was deleted or forgotten on this phone. */
  onGone: () => void
  /** Called with the room's name once known, e.g. to remember it on the phone. */
  onName?: (name: string) => void
}

type Sheet = null | 'add' | 'edit' | 'settle' | 'people' | 'invite' | 'more' | 'payback'

export function RoomView({ room, link, myId, onMyId, onExit, onGone, onName }: RoomViewProps) {
  const { backend, copy, locale } = useSplit()
  const c = copy.room
  const { loaded, status, live, reload } = useRoom(backend, room)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [editing, setEditing] = useState<Entry<Expense> | null>(null)
  const [payback, setPayback] = useState<Entry<Payment> | null>(null)

  const state = loaded?.state
  const currency = state?.info?.data.currency ?? 'SEK'
  const money = useMoney(currency)

  const sums = useMemo(() => {
    if (!state) return null
    const ids = state.members.map((m) => m.id)
    const { balances, skipped } = computeBalances(ids, state.expenses.map((e) => e.data), state.payments.map((p) => p.data))
    return { balances, skipped, transfers: settleUp(balances) }
  }, [state])

  const name = state?.info?.data.name
  useEffect(() => {
    if (name) onName?.(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  if (status === 'not_found') {
    return (
      <div className="sp-screen sp-center-screen">
        <h1 className="sp-title">{c.notFound}</h1>
        <p className="sp-muted">{c.notFoundSub}</p>
        <Button onClick={onGone}>{copy.common.back}</Button>
      </div>
    )
  }
  if (!state || !state.info || !sums) {
    return status === 'error' ? (
      <div className="sp-screen sp-center-screen">
        <h1 className="sp-title">{c.loadError}</h1>
        <p className="sp-muted">{c.loadErrorSub}</p>
        <Button onClick={() => void reload()}>{copy.common.tryAgain}</Button>
        <Button variant="quiet" onClick={onExit}>{copy.common.back}</Button>
      </div>
    ) : (
      <div className="sp-screen sp-center-screen" aria-busy="true"><span className="sp-spinner" aria-label="Loading" /></div>
    )
  }

  const me = myId ? state.members.find((m) => m.id === myId) : undefined
  if (!me) return <WhoAreYou room={room} state={state} onPicked={onMyId} onReload={reload} />

  const myBalance = sums.balances.get(me.id) ?? 0
  const realName = (id: string) => state.members.find((m) => m.id === id)?.data.name ?? '?'
  const nameOf = (id: string) => (id === me.id ? copy.common.youCap : realName(id))
  const known = new Set(state.members.map((m) => m.id))

  // One timeline of expenses and paybacks, newest first.
  const timeline: (Entry<Expense> | Entry<Payment>)[] = [...state.expenses, ...state.payments].sort(
    (a, b) => b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt),
  )

  const settledUntil = state.settledAt
    ? formatDay(new Date(new Date(state.settledAt).getTime() + 7 * 864e5).toISOString().slice(0, 10), locale)
    : null

  return (
    <div className="sp-screen sp-room">
      <header className="sp-top">
        <button type="button" className="sp-icon-btn" onClick={onExit} aria-label={copy.common.back}><Icon name="back" /></button>
        <div className="sp-top-title">
          <h1>{state.info.data.name}</h1>
          <span className={`sp-live${live ? ' is-live' : ''}`}>{live ? c.live : c.offline}</span>
        </div>
        <button type="button" className="sp-icon-btn" onClick={() => setSheet('people')} aria-label={c.people}><Icon name="people" /></button>
        <button type="button" className="sp-icon-btn" onClick={() => setSheet('invite')} aria-label={c.invite}><Icon name="share" /></button>
        <button type="button" className="sp-icon-btn" onClick={() => setSheet('more')} aria-label={c.more}><Icon name="more" /></button>
      </header>

      {settledUntil ? (
        <div className="sp-banner">
          <strong>{c.settledBanner}</strong>
          <span>{c.settledSub(settledUntil)}</span>
          <button type="button" className="sp-link" onClick={() => void setSettled(backend, room, false).then(reload, reload)}>{copy.common.undo}</button>
        </div>
      ) : null}

      <section className="sp-balance" aria-label={c.yourBalance}>
        {myBalance === 0 ? (
          <>
            <p className="sp-balance-big">{c.square}</p>
            <p className="sp-muted">{c.squareSub}</p>
          </>
        ) : (
          <>
            <p className="sp-label">{myBalance > 0 ? c.getBack : c.toSend}</p>
            <p className="sp-balance-big">{money(Math.abs(myBalance))}</p>
          </>
        )}
        {sums.transfers.length || (!state.settledAt && timeline.length) ? (
          <button type="button" className="sp-balance-action" onClick={() => setSheet('settle')}>
            {c.settleUp} <Icon name="arrow" />
          </button>
        ) : null}
      </section>

      {loaded!.unreadable ? <p className="sp-hint">{c.unreadable(loaded!.unreadable)}</p> : null}
      {sums.skipped ? <p className="sp-hint">{c.skipped(sums.skipped)}</p> : null}

      {timeline.length === 0 ? (
        <div className="sp-empty">
          <p className="sp-empty-title">{c.empty}</p>
          <p className="sp-muted">{c.emptySub}</p>
        </div>
      ) : (
        <ul className="sp-list">
          {timeline.map((e) => {
            if (e.data.kind === 'payment') {
              const p = e.data
              return (
                <li key={e.id}>
                  <button type="button" className="sp-row sp-row-payment" onClick={() => { setPayback(e as Entry<Payment>); setSheet('payback') }}>
                    <div className="sp-row-main">
                      <span className="sp-row-title">{c.paidBack(nameOf(p.from), nameOf(p.to))}</span>
                      <span className="sp-row-sub">{formatDay(p.date, locale)}</span>
                    </div>
                    <span className="sp-row-amount">{money(p.amount)}</span>
                  </button>
                </li>
              )
            }
            const x = e.data
            const ways = x.split.mode === 'equal' ? x.split.among.filter((id) => known.has(id)).length : null
            const mine = shareOut(x.amount, x.split, known)?.get(me.id)
            return (
              <li key={e.id}>
                <button type="button" className="sp-row" onClick={() => { setEditing(e as Entry<Expense>); setSheet('edit') }}>
                  <Initial name={realName(x.paidBy)} id={x.paidBy} />
                  <div className="sp-row-main">
                    <span className="sp-row-title">{x.title}</span>
                    <span className="sp-row-sub">
                      {x.paidBy === me.id ? c.paidByYou : c.paidBy(nameOf(x.paidBy))} · {ways !== null ? c.splitWays(ways) : c.splitCustom} · {formatDay(x.date, locale)}
                    </span>
                  </div>
                  <span className="sp-row-amount">
                    {money(x.amount)}
                    {mine ? <small>{c.yourPart(money(mine))}</small> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="sp-dock">
        <Button onClick={() => { setEditing(null); setSheet('add') }}><Icon name="plus" /> {c.addExpense}</Button>
      </div>

      <ExpenseSheet open={sheet === 'add' || sheet === 'edit'} onClose={() => setSheet(null)} room={room} state={state} myId={me.id} editing={sheet === 'edit' ? editing : null} onSaved={reload} />
      <SettleSheet open={sheet === 'settle'} onClose={() => setSheet(null)} room={room} state={state} myId={me.id} transfers={sums.transfers} onSaved={reload} />
      <PeopleSheet open={sheet === 'people'} onClose={() => setSheet(null)} room={room} state={state} myId={me.id} onSaved={reload} onSwitchMe={() => { setSheet(null); onMyId(null) }} />
      <InviteSheet open={sheet === 'invite'} onClose={() => setSheet(null)} link={link} roomName={state.info.data.name} />
      <BottomSheet open={sheet === 'payback'} title={c.paybackTitle} onClose={() => setSheet(null)}
        foot={<><Button variant="danger" onClick={() => { const id = payback?.id; setSheet(null); if (id) void deleteEntry(backend, room, id).then(reload, reload) }}>{c.paybackRemove}</Button><Button variant="quiet" onClick={() => setSheet(null)}>{copy.common.cancel}</Button></>}>
        <p className="sp-muted">{c.paybackSub}</p>
      </BottomSheet>
      <MoreSheet open={sheet === 'more'} onClose={() => setSheet(null)} room={room} onDeleted={onGone} onForget={onGone} />
    </div>
  )
}
