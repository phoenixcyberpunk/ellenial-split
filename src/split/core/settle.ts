import type { Balances } from './balances'

/*
  Fewest transfers to get everyone square.

  The usual shortcut (biggest sender pays biggest receiver, repeat) is fast but sometimes
  costs one transfer too many. The true minimum is: people minus the largest number of
  separate groups that each add up to zero on their own (each such group of k people
  settles in k - 1 transfers). Finding those groups is an exact search over subsets,
  instant on a phone for up to ~15 people with money to move. Above that we fall back to
  the shortcut, which is never more than (people - 1) transfers.

  Deterministic: same balances in, same transfers out, on every phone.
*/

export type Transfer = { from: string; to: string; amount: number }

export const EXACT_LIMIT = 15

export function settleUp(balances: Balances): Transfer[] {
  const people = [...balances.entries()]
    .filter(([, n]) => n !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  if (people.length < 2) return []
  if (people.length > EXACT_LIMIT) return greedy(people)

  const n = people.length
  const full = (1 << n) - 1
  const sum = new Array<number>(full + 1).fill(0)
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sum[mask] = sum[mask ^ low] + people[31 - Math.clz32(low)][1]
  }

  // best[mask] = most zero-sum groups the people in `mask` can be split into,
  // building the mask up one person at a time. pick[] remembers who came last.
  const best = new Int8Array(full + 1)
  const pick = new Int8Array(full + 1)
  for (let mask = 1; mask <= full; mask++) {
    let top = -1
    let who = 0
    for (let rest = mask; rest; rest &= rest - 1) {
      const bit = 31 - Math.clz32(rest & -rest)
      const v = best[mask ^ (1 << bit)]
      if (v > top) { top = v; who = bit }
    }
    best[mask] = top + (sum[mask] === 0 ? 1 : 0)
    pick[mask] = who
  }

  // Walk back down: every time the remaining set adds up to zero, the people peeled off
  // since the last such point form one group.
  const groups: [string, number][][] = []
  let current: [string, number][] = []
  for (let mask = full; mask; ) {
    const bit = pick[mask]
    current.push(people[bit])
    mask ^= 1 << bit
    if (sum[mask] === 0) { groups.push(current); current = [] }
  }

  return groups.flatMap(greedy)
}

/** Biggest sender to biggest receiver until everyone is square. */
function greedy(people: [string, number][]): Transfer[] {
  const senders = people.filter(([, n]) => n < 0).map(([id, n]) => ({ id, left: -n }))
  const receivers = people.filter(([, n]) => n > 0).map(([id, n]) => ({ id, left: n }))
  const order = (a: { id: string; left: number }, b: { id: string; left: number }) => b.left - a.left || (a.id < b.id ? -1 : 1)
  const out: Transfer[] = []
  while (senders.length && receivers.length) {
    senders.sort(order)
    receivers.sort(order)
    const s = senders[0]
    const r = receivers[0]
    const amount = Math.min(s.left, r.left)
    out.push({ from: s.id, to: r.id, amount })
    s.left -= amount
    r.left -= amount
    if (!s.left) senders.shift()
    if (!r.left) receivers.shift()
  }
  return out
}
