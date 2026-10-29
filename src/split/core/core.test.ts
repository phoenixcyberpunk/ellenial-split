/*
  Plain tests for the pure maths, no framework needed: `npx tsx src/split/core/core.test.ts`.
  Exits with code 1 on the first failure.
*/
import { parseAmount, formatAmount } from './money'
import { shareOut, computeBalances } from './balances'
import { settleUp, type Transfer } from './settle'
import type { Expense, Payment } from './model'

let passed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error(`FAIL ${name}`, detail ?? '')
    process.exit(1)
  }
  passed++
}

// ---------- parseAmount ----------
const amounts: [string, number | null][] = [
  ['120', 12000], ['120,50', 12050], ['120.5', 12050], ['1 299,90', 129990], ['1.299,90', 129990],
  ['1,299.90', 129990], ['1.299', 129900], ['1,299', 129900], ['0,05', 5], ['250 kr', 25000],
  ['', null], ['0', null], ['-5', null], ['abc', null], ['1,2345', null], ['12.3.4', null], ['99999999999', null],
]
for (const [input, want] of amounts) check(`parseAmount(${JSON.stringify(input)})`, parseAmount(input) === want, parseAmount(input))
check('formatAmount whole', /120/.test(formatAmount(12000, 'SEK', 'sv-SE')) && !/,00/.test(formatAmount(12000, 'SEK', 'sv-SE')))

// ---------- shareOut ----------
const ids = ['a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000c']
const known = new Set(ids)
const third = shareOut(10000, { mode: 'equal', among: ids }, known)!
check('equal split adds up', [...third.values()].reduce((a, b) => a + b, 0) === 10000, third)
check('equal split differs by at most 1 öre', Math.max(...third.values()) - Math.min(...third.values()) <= 1, third)
check('equal split same on every phone', JSON.stringify([...shareOut(10000, { mode: 'equal', among: [...ids].reverse() }, known)!].sort()) === JSON.stringify([...third].sort()))
check('equal split ignores unknown people', shareOut(900, { mode: 'equal', among: [ids[0], 'ffffffff-0000-4000-8000-000000000000'] }, known)!.get(ids[0]) === 900)
check('equal split with nobody known is refused', shareOut(900, { mode: 'equal', among: ['ffffffff-0000-4000-8000-000000000000'] }, known) === null)
const shares = shareOut(1000, { mode: 'shares', shares: { [ids[0]]: 2, [ids[1]]: 1 } }, known)!
check('shares 2:1', shares.get(ids[0]) === 667 && shares.get(ids[1]) === 333, shares)
check('exact must add up', shareOut(1000, { mode: 'exact', amounts: { [ids[0]]: 400, [ids[1]]: 500 } }, known) === null)
check('exact for unknown person refused', shareOut(1000, { mode: 'exact', amounts: { [ids[0]]: 500, 'ffffffff-0000-4000-8000-000000000000': 500 } }, known) === null)

// ---------- balances ----------
const exp = (amount: number, paidBy: string, among = ids): Expense => ({ kind: 'expense', v: 1, title: 't', amount, paidBy, split: { mode: 'equal', among }, date: '2026-10-29' })
const pay = (from: string, to: string, amount: number): Payment => ({ kind: 'payment', v: 1, from, to, amount, date: '2026-10-29' })
const { balances } = computeBalances(ids, [exp(30000, ids[0]), exp(6000, ids[1])], [])
check('balances sum to zero', [...balances.values()].reduce((a, b) => a + b, 0) === 0, balances)
check('payer is ahead', balances.get(ids[0]) === 30000 - 12000, balances)
const after = computeBalances(ids, [exp(30000, ids[0])], [pay(ids[1], ids[0], 10000), pay(ids[2], ids[0], 10000)]).balances
check('payments square everyone', [...after.values()].every((v) => v === 0), after)
check('expense paid by a stranger is skipped', computeBalances(ids, [exp(500, 'ffffffff-0000-4000-8000-000000000000')], []).skipped === 1)

// ---------- settleUp ----------
function applies(bal: Map<string, number>, transfers: Transfer[]): boolean {
  const m = new Map(bal)
  for (const t of transfers) {
    if (t.amount <= 0 || t.from === t.to) return false
    m.set(t.from, m.get(t.from)! + t.amount)
    m.set(t.to, m.get(t.to)! - t.amount)
  }
  return [...m.values()].every((v) => v === 0)
}

/** Independent answer: try every way of splitting people into groups (only for small n). */
function bruteMinTransfers(values: number[]): number {
  const n = values.length
  let bestGroups = 0
  const assign = new Array<number>(n).fill(0)
  function rec(i: number, groupCount: number) {
    if (i === n) {
      const sums = new Array<number>(groupCount).fill(0)
      for (let k = 0; k < n; k++) sums[assign[k]] += values[k]
      if (sums.every((s) => s === 0)) bestGroups = Math.max(bestGroups, groupCount)
      return
    }
    for (let g = 0; g <= groupCount; g++) {
      assign[i] = g
      rec(i + 1, Math.max(groupCount, g + 1))
    }
  }
  rec(0, 0)
  return n - bestGroups
}

function randomBalances(n: number, rand: () => number, smallNumbers: boolean): Map<string, number> {
  const m = new Map<string, number>()
  let total = 0
  for (let i = 0; i < n - 1; i++) {
    let v = smallNumbers ? Math.floor(rand() * 9 - 4) * 100 : Math.floor(rand() * 200000 - 100000)
    if (v === 0) v = 100
    m.set(`p${String(i).padStart(2, '0')}`, v)
    total += v
  }
  m.set(`p${String(n - 1).padStart(2, '0')}`, -total)
  return m
}

let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)

let beatShortcut = 0
for (let round = 0; round < 3000; round++) {
  const n = 2 + (round % 7) // 2..8 people
  const bal = randomBalances(n, rand, round % 2 === 0) // small numbers make zero-sum groups likely
  const t = settleUp(bal)
  const nonZero = [...bal.values()].filter((v) => v !== 0)
  check(`settle round ${round} squares everyone`, applies(bal, t), { bal: [...bal], t })
  check(`settle round ${round} is minimal`, t.length === bruteMinTransfers(nonZero), { bal: [...bal], t, want: bruteMinTransfers(nonZero) })
  // Compare with the plain shortcut (what most split apps do)
  const greedyCount = settleUpGreedyOnly(bal).length
  check(`settle round ${round} never worse than shortcut`, t.length <= greedyCount)
  if (t.length < greedyCount) beatShortcut++
}

/** The plain shortcut most split apps use, for comparison. */
function settleUpGreedyOnly(bal: Map<string, number>): Transfer[] {
  const s = [...bal].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }))
  const r = [...bal].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }))
  const out: Transfer[] = []
  while (s.length && r.length) {
    s.sort((a, b) => b.left - a.left); r.sort((a, b) => b.left - a.left)
    const amount = Math.min(s[0].left, r[0].left)
    out.push({ from: s[0].id, to: r[0].id, amount })
    s[0].left -= amount; r[0].left -= amount
    if (!s[0].left) s.shift()
    if (!r[0].left) r.shift()
  }
  return out
}

// A real case where the shortcut needs one transfer too many (7 people): the exact search
// spots that {c,e}, {d,f} and {a,b,g} each add up to zero on their own.
const tricky = new Map([['a', -300], ['b', 600], ['c', -500], ['d', -200], ['e', 500], ['f', 200], ['g', -300]])
check('tricky case: exact finds 4', settleUp(tricky).length === 4, settleUp(tricky))
check('tricky case: shortcut needs 5', settleUpGreedyOnly(tricky).length === 5, settleUpGreedyOnly(tricky))

const stable1 = JSON.stringify(settleUp(new Map([['a', -600], ['b', -100], ['c', 200], ['d', 500]])))
const stable2 = JSON.stringify(settleUp(new Map([['d', 500], ['c', 200], ['b', -100], ['a', -600]])))
check('same answer whatever order people come in', stable1 === stable2, [stable1, stable2])

// Larger rooms: still squares everyone, fast.
for (let round = 0; round < 50; round++) {
  const bal = randomBalances(15, rand, true)
  const t0 = Date.now()
  const t = settleUp(bal)
  check(`15 people round ${round} squares`, applies(bal, t))
  check(`15 people round ${round} fast`, Date.now() - t0 < 500, Date.now() - t0)
}
for (let round = 0; round < 50; round++) {
  const bal = randomBalances(30, rand, false)
  const t = settleUp(bal)
  check(`30 people round ${round} squares`, applies(bal, t))
  check(`30 people round ${round} at most n-1`, t.length <= 29)
}

console.log(`All ${passed} checks passed. Exact search beat the shortcut in ${beatShortcut} of 3000 random rooms.`)
