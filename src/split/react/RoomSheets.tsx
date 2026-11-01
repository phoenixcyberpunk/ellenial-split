import { useState, type ReactNode } from 'react'
import { deleteRoom, type OpenRoom } from '../data/room'
import { useSplit } from './context'
import { Button, QrCode, Sheet } from './ui'

export function InviteSheet({ open, onClose, link, roomName }: { open: boolean; onClose: () => void; link: string; roomName: string }) {
  const { copy } = useSplit()
  const c = copy.invite
  const [copied, setCopied] = useState(false)
  const text = `${c.shareText(roomName)}\n${link}`
  // Text and link as ONE message: some chat apps keep only one of the two (learned in Gillefeeling).
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the QR still works */ }
  }

  return (
    <Sheet open={open} title={c.title} onClose={onClose}
      foot={
        <>
          {canShare ? <Button onClick={() => navigator.share({ text }).catch(() => {})}>{c.share}</Button> : null}
          <Button variant={canShare ? 'secondary' : 'primary'} onClick={copyLink}>{copied ? c.copied : c.copy}</Button>
        </>
      }>
      <p className="sp-muted">{c.lead}</p>
      <QrCode value={link} label={c.qrLabel} />
      <p className="sp-hint sp-center">{c.keepSafe}</p>
    </Sheet>
  )
}

export function MoreSheet({ open, onClose, room, onDeleted, onForget, extra }: {
  open: boolean
  /** Host's own settings for this sheet, e.g. the Ellenial theme switch. */
  extra?: ReactNode
  onClose: () => void
  room: OpenRoom
  onDeleted: () => void
  onForget: () => void
}) {
  const { backend, copy } = useSplit()
  const c = copy.more
  const [confirm, setConfirm] = useState<'delete' | 'forget' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function del() {
    setBusy(true)
    setError(false)
    try {
      await deleteRoom(backend, room)
      onDeleted()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (confirm === 'delete') {
    return (
      <Sheet open={open} title={c.deleteConfirm} onClose={() => setConfirm(null)}
        foot={<>{error ? <p className="sp-error" role="alert">{copy.expense.errors.generic}</p> : null}<Button variant="danger" onClick={del} disabled={busy}>{copy.common.delete}</Button><Button variant="quiet" onClick={() => setConfirm(null)}>{copy.common.cancel}</Button></>}>
        <p className="sp-muted">{c.deleteSub}</p>
      </Sheet>
    )
  }
  if (confirm === 'forget') {
    return (
      <Sheet open={open} title={c.leave} onClose={() => setConfirm(null)}
        foot={<><Button onClick={onForget}>{c.leave}</Button><Button variant="quiet" onClick={() => setConfirm(null)}>{copy.common.cancel}</Button></>}>
        <p className="sp-muted">{c.leaveSub}</p>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} title={c.title} onClose={onClose} foot={<Button variant="quiet" onClick={onClose}>{copy.common.close}</Button>}>
      <details className="sp-details" open>
        <summary>{c.privacy}</summary>
        {c.privacyText.map((p) => <p key={p}>{p}</p>)}
      </details>
      {extra}
      <Button variant="secondary" onClick={() => setConfirm('forget')}>{c.leave}</Button>
      <Button variant="danger" onClick={() => setConfirm('delete')}>{c.deleteRoom}</Button>
    </Sheet>
  )
}
