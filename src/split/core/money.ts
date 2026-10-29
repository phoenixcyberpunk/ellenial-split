/*
  Money is always whole minor units (öre, cents) as plain integers. Never floats:
  0.1 + 0.2 must not turn into a 1-öre mystery between friends.
*/

export const CURRENCIES = ['SEK', 'EUR', 'NOK', 'DKK', 'USD', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export function isCurrency(v: unknown): v is Currency {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)
}

/** Biggest single amount we accept: 10 million in major units. Catches typos, keeps maths safe. */
export const MAX_AMOUNT = 1_000_000_000

/**
 * Reads what a person typed ("120", "120,50", "1 299.9", "1.299,90") into minor units.
 * Returns null for anything that isn't a clear, positive amount.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s  ']/g, '').replace(/kr$|sek$|€|\$|£/i, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const decimalAt = Math.max(lastComma, lastDot)
  if (decimalAt >= 0) {
    const decimals = s.length - decimalAt - 1
    const head = s.slice(0, decimalAt)
    // Anything before the last separator must be plain digits or proper thousands groups
    // ("1.299" yes, "12.3" before ".4" no), so "12.3.4" is refused rather than guessed.
    if (/[.,]/.test(head) && !/^\d{1,3}([.,]\d{3})+$/.test(head)) return null
    if (decimals > 0 && decimals <= 2) {
      // The last separator is the decimal one; any others were thousands separators.
      s = s.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + s.slice(decimalAt + 1)
    } else if (decimals === 3 || decimals === 0) {
      // "1.299" or "1,299" = thousands; "120," = a stray separator.
      s = s.replace(/[.,]/g, '')
    } else {
      return null
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_AMOUNT ? minor : null
}

/** "1 299,50 kr" style, following the phone's language. Whole amounts drop the decimals. */
export function formatAmount(minor: number, currency: Currency, locale?: string): string {
  const whole = minor % 100 === 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(whole ? 0 : 2)} ${currency}`
  }
}

/** For prefilling an input: "120" or "120.50" (no currency, no grouping). */
export function amountToInput(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}
