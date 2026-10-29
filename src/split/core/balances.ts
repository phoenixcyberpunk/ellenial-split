import type { Expense, Payment, Split } from './model'

/*
  Who is ahead and who is behind, in minor units. Positive = gets money back, negative = sends.
  Pure and deterministic: every phone in the room must get exactly the same numbers.
*/

/**
 * How much of `amount` each person carries. Always adds up to exactly `amount`:
 * leftover öre go one each to people in a fixed order (sorted ids), so all phones agree.
 * Returns null if the split points at nobody we know.
 */
export function shareOut(amount: number, split: Split, known: ReadonlySet<string>): Map<string, number> | null {
  const out = new Map<string, number>()
  if (split.mode === 'exact') {
    let sum = 0
    for (const [id, n] of Object.entries(split.amounts)) {
      if (!known.has(id)) return null // money for someone who left would vanish: refuse instead
      if (n > 0) out.set(id, n)
      sum += n
    }
    return sum === amount ? out : null
  }

  const weights = new Map<string, number>()
  if (split.mode === 'equal') for (const id of split.among) { if (known.has(id)) weights.set(id, 1) }
  else for (const [id, w] of Object.entries(split.shares)) { if (known.has(id)) weights.set(id, w) }
  if (!weights.size) return null

  const ids = [...weights.keys()].sort()
  const total = ids.reduce((s, id) => s + weights.get(id)!, 0)
  let given = 0
  const rests: { id: string; rest: number }[] = []
  for (const id of ids) {
    const exact = (amount * weights.get(id)!) / total
    const base = Math.floor(exact)
    out.set(id, base)
    given += base
    rests.push({ id, rest: exact - base })
  }
  // Largest remainder first; ties by id. Hands out the last few öre fairly.
  rests.sort((a, b) => b.rest - a.rest || (a.id < b.id ? -1 : 1))
  for (let i = 0; given < amount; i++, given++) {
    const id = rests[i % rests.length].id
    out.set(id, out.get(id)! + 1)
  }
  return out
}

export type Balances = Map<string, number>

export function computeBalances(memberIds: string[], expenses: Expense[], payments: Payment[]): { balances: Balances; skipped: number } {
  const known = new Set(memberIds)
  const balances: Balances = new Map(memberIds.map((id) => [id, 0]))
  let skipped = 0

  for (const e of expenses) {
    const shares = known.has(e.paidBy) ? shareOut(e.amount, e.split, known) : null
    if (!shares) { skipped++; continue }
    balances.set(e.paidBy, balances.get(e.paidBy)! + e.amount)
    for (const [id, n] of shares) balances.set(id, balances.get(id)! - n)
  }
  for (const p of payments) {
    if (!known.has(p.from) || !known.has(p.to)) { skipped++; continue }
    balances.set(p.from, balances.get(p.from)! + p.amount)
    balances.set(p.to, balances.get(p.to)! - p.amount)
  }
  return { balances, skipped }
}
