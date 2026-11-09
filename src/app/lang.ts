import { createContext, useContext } from 'react'

/*
  English or Swedish, the same way as ellenial maps: the phone's language decides (Swedish if any
  of its languages is Swedish), unless the person picks one in the footer or the room's More sheet.
  The pick is saved on this phone only.
*/

export type Lang = 'en' | 'sv'
const KEY = 'ellenial-split:lang'

export function initialLang(): Lang {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved === 'en' || saved === 'sv') return saved
  } catch { /* private mode or bad value: fall through */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en']
  return langs.some((l) => /^sv\b/i.test(l)) ? 'sv' : 'en'
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(KEY, JSON.stringify(lang)) } catch { /* private mode: fine */ }
}

export const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })
export const useLang = () => useContext(LangCtx)
