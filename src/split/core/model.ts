import { isCurrency, MAX_AMOUNT, type Currency } from './money'

/*
  What lives inside a room. Every entry is one encrypted blob on the server; the kind is
  inside the blob, so the server can't tell people from expenses.

  Decrypted data is UNTRUSTED: anyone holding the link can write anything. Every parser
  here checks shapes and limits and drops what doesn't fit, instead of crashing a friend's phone.
*/

export type RoomInfo = { kind: 'room'; v: 1; name: string; currency: Currency }
export type Member = { kind: 'member'; v: 1; name: string }

export type Split =
  | { mode: 'equal'; among: string[] }
  /** Exact minor amounts per person; must add up to the expense amount. */
  | { mode: 'exact'; amounts: Record<string, number> }
  /** Weights per person ("2 portions"). In the model now, UI later. */
  | { mode: 'shares'; shares: Record<string, number> }

export type Expense = {
  kind: 'expense'
  v: 1
  title: string
  amount: number
  paidBy: string
  split: Split
  /** Local date the expense happened, YYYY-MM-DD. */
  date: string
  /** Who added it (member id), for "added by". */
  addedBy?: string
}

/** Someone paid someone back. Moves balances like an expense the receiver "pays" for the sender. */
export type Payment = { kind: 'payment'; v: 1; from: string; to: string; amount: number; date: string }

export type EntryData = RoomInfo | Member | Expense | Payment

/** An entry as the phone knows it: decrypted data plus the server's bookkeeping. */
export type Entry<T extends EntryData = EntryData> = { id: string; revision: number; updatedAt: string; data: T }

export const LIMITS = {
  roomName: 60,
  memberName: 30,
  title: 80,
  maxPeople: 50,
} as const

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= MAX_AMOUNT
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? [...s].slice(0, max).join('') : null
}

function parseSplit(v: unknown): Split | null {
  if (!isObj(v)) return null
  if (v.mode === 'equal') {
    if (!Array.isArray(v.among)) return null
    const among = [...new Set(v.among.filter(isId))]
    return among.length ? { mode: 'equal', among } : null
  }
  if (v.mode === 'exact' || v.mode === 'shares') {
    const src = v.mode === 'exact' ? v.amounts : v.shares
    if (!isObj(src)) return null
    const out: Record<string, number> = {}
    for (const [k, n] of Object.entries(src)) {
      if (!isId(k)) continue
      if (v.mode === 'exact' ? typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_AMOUNT : typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 100) {
        out[k] = n as number
      }
    }
    if (!Object.keys(out).length) return null
    return v.mode === 'exact' ? { mode: 'exact', amounts: out } : { mode: 'shares', shares: out }
  }
  return null
}

export function parseEntryData(v: unknown): EntryData | null {
  if (!isObj(v) || v.v !== 1) return null
  switch (v.kind) {
    case 'room': {
      const name = cleanText(v.name, LIMITS.roomName)
      return name && isCurrency(v.currency) ? { kind: 'room', v: 1, name, currency: v.currency } : null
    }
    case 'member': {
      const name = cleanText(v.name, LIMITS.memberName)
      return name ? { kind: 'member', v: 1, name } : null
    }
    case 'expense': {
      const title = cleanText(v.title, LIMITS.title)
      const split = parseSplit(v.split)
      if (!title || !isAmount(v.amount) || !isId(v.paidBy) || !split || !isDate(v.date)) return null
      if (split.mode === 'exact' && Object.values(split.amounts).reduce((a, b) => a + b, 0) !== v.amount) return null
      return { kind: 'expense', v: 1, title, amount: v.amount, paidBy: v.paidBy, split, date: v.date, ...(isId(v.addedBy) ? { addedBy: v.addedBy } : {}) }
    }
    case 'payment': {
      if (!isId(v.from) || !isId(v.to) || v.from === v.to || !isAmount(v.amount) || !isDate(v.date)) return null
      return { kind: 'payment', v: 1, from: v.from, to: v.to, amount: v.amount, date: v.date }
    }
  }
  return null
}

/** The whole room, sorted out by kind. Built once per fetch. */
export type RoomState = {
  info: Entry<RoomInfo> | null
  members: Entry<Member>[]
  expenses: Entry<Expense>[]
  payments: Entry<Payment>[]
  settledAt: string | null
}

export function buildRoomState(entries: Entry[], settledAt: string | null, roomId: string): RoomState {
  const state: RoomState = { info: null, members: [], expenses: [], payments: [], settledAt }
  for (const e of entries) {
    const d = e.data
    // The room's own settings always live at the room's id, so nobody can sneak in a second one.
    if (d.kind === 'room') { if (e.id === roomId) state.info = e as Entry<RoomInfo> }
    else if (e.id === roomId) continue
    else if (d.kind === 'member') state.members.push(e as Entry<Member>)
    else if (d.kind === 'expense') state.expenses.push(e as Entry<Expense>)
    else if (d.kind === 'payment') state.payments.push(e as Entry<Payment>)
  }
  state.members = state.members.slice(0, LIMITS.maxPeople)
  // Newest first; same day falls back to when it was saved.
  const byDate = (a: Entry<Expense | Payment>, b: Entry<Expense | Payment>) =>
    b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt)
  state.expenses.sort(byDate)
  state.payments.sort(byDate)
  return state
}

export function todayLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
