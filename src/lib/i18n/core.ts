/**
 * Tiny translation system. The English text itself is the key:
 *   t("Find markets")  →  "Buscar mercados" in Spanish
 *   t("Hi, {name}", { name })
 * Anything not translated yet simply shows in English.
 */
import { es } from "./es.ts"

export type Lang = "en" | "es"
export const LANGS: Lang[] = ["en", "es"]
export const LANG_COOKIE = "lang"

const DICTS: Record<Lang, Record<string, string>> = { en: {}, es }

export type T = (text: string, vars?: Record<string, string | number>) => string

export function makeT(lang: Lang): T {
  const dict = DICTS[lang] ?? {}
  return (text, vars) => {
    let out = dict[text] ?? text
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
    return out
  }
}

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "es"
}

/** Dates in the reader's language: "Sat, Oct 4, 2026" / "sáb, 4 oct 2026". */
export function localeFor(lang: Lang) {
  return lang === "es" ? "es-US" : "en-US"
}
