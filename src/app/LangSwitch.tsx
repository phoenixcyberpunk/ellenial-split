import { appCopy } from './copy'
import { useLang, type Lang } from './lang'

/** EN | SV, same as ellenial maps, styled like the theme switch beside it. */
export function LangSwitch() {
  const { lang, setLang } = useLang()
  const btn = (code: Lang) => (
    <button type="button" className="app-lang__btn" aria-pressed={lang === code} lang={code} onClick={() => setLang(code)}>
      {code.toUpperCase()}
    </button>
  )
  return (
    <span className="app-lang" role="group" aria-label={appCopy.language}>
      {btn('en')}<span aria-hidden="true">|</span>{btn('sv')}
    </span>
  )
}

/** A labelled row for the room's More sheet, like ThemeRow. */
export function LangRow() {
  return (
    <div className="app-theme-row">
      <span className="sp-label">{appCopy.language}</span>
      <LangSwitch />
    </div>
  )
}
