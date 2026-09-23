"use client"

import { createContext, useContext, useMemo } from "react"
import { makeT, type Lang, type T } from "./core"

const LangContext = createContext<{ lang: Lang; t: T }>({ lang: "en", t: makeT("en") })

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

/** In client components:  const { t, lang } = useT() */
export function useT() {
  return useContext(LangContext)
}
