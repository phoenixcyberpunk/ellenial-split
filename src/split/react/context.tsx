import { createContext, useContext, type ReactNode } from 'react'
import type { SplitBackend } from '../data/backend'
import { splitCopy, type SplitCopy } from '../copy/en'
import { formatAmount, type Currency } from '../core/money'

type SplitEnv = { backend: SplitBackend; copy: SplitCopy; locale?: string }

const Ctx = createContext<SplitEnv | null>(null)

/** Wrap the module's screens once. The host passes its Supabase client (and optionally its own words). */
export function SplitProvider({ backend, copy = splitCopy, locale, children }: { backend: SplitBackend; copy?: SplitCopy; locale?: string; children: ReactNode }) {
  return <Ctx.Provider value={{ backend, copy, locale }}>{children}</Ctx.Provider>
}

export function useSplit() {
  const env = useContext(Ctx)
  if (!env) throw new Error('Wrap split screens in <SplitProvider>')
  return env
}

export function useMoney(currency: Currency) {
  const { locale } = useSplit()
  return (minor: number) => formatAmount(minor, currency, locale)
}

export function formatDay(date: string, locale?: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const sameYear = y === new Date().getFullYear()
  return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}
