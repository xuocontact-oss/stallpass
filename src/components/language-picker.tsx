"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, X } from "lucide-react"
import { LANG_COOKIE } from "@/lib/i18n/core"
import { useT } from "@/lib/i18n/client"

const YEAR = 60 * 60 * 24 * 365
const OTHER_COOKIE = "lang_other"

function setCookie(name: string, value: string, maxAge = YEAR) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

/** Opens the language chooser from anywhere (the 🌐 buttons). */
export function openLanguagePicker() {
  window.dispatchEvent(new Event("open-language-picker"))
}

/**
 * First-visit pop-up: English / Español / Other language. "Other" turns on a
 * translator bar (Google's free page translator) for 100+ languages.
 */
export function LanguagePicker({ hasChosen }: { hasChosen: boolean }) {
  const router = useRouter()
  const { lang } = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasChosen) setOpen(true)
    const handler = () => setOpen(true)
    window.addEventListener("open-language-picker", handler)
    return () => window.removeEventListener("open-language-picker", handler)
  }, [hasChosen])

  function choose(choice: "en" | "es" | "other") {
    setCookie(LANG_COOKIE, choice === "es" ? "es" : "en")
    setCookie(OTHER_COOKIE, choice === "other" ? "1" : "", choice === "other" ? YEAR : 0)
    if (choice !== "other") {
      // Turn the page translator off again if it was on.
      document.cookie = "googtrans=; Path=/; Max-Age=0"
      document.cookie = `googtrans=; Path=/; Domain=${location.hostname}; Max-Age=0`
    }
    setOpen(false)
    if (choice === "other" || document.documentElement.classList.contains("translated-ltr")) window.location.reload()
    else router.refresh()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Choose your language">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold">
              <Globe className="size-5 text-primary" aria-hidden /> Language · Idioma
            </p>
            <p className="text-sm text-muted-foreground">Choose your language · Elige tu idioma</p>
          </div>
          {hasChosen && (
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="p-1 text-muted-foreground">
              <X className="size-5" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => choose("en")} className="flex w-full items-center justify-between rounded-xl border-2 p-4 text-left font-semibold hover:border-primary aria-[current=true]:border-primary" aria-current={lang === "en"}>
          English <span aria-hidden>🇺🇸</span>
        </button>
        <button type="button" onClick={() => choose("es")} className="flex w-full items-center justify-between rounded-xl border-2 p-4 text-left font-semibold hover:border-primary aria-[current=true]:border-primary" aria-current={lang === "es"}>
          Español <span aria-hidden>🇲🇽</span>
        </button>
        <button type="button" onClick={() => choose("other")} className="flex w-full items-center justify-between rounded-xl border-2 p-4 text-left hover:border-primary">
          <span>
            <span className="block font-semibold">Other language</span>
            <span className="text-xs text-muted-foreground">中文 · 한국어 · Tiếng Việt · Tagalog · Հայերեն · 100+ more</span>
          </span>
          <Globe className="size-5 text-muted-foreground" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Small 🌐 button that reopens the chooser. */
export function LanguageButton({ className }: { className?: string }) {
  const { lang } = useT()
  return (
    <button type="button" onClick={openLanguagePicker} className={className} aria-label="Change language">
      <Globe className="size-4" aria-hidden /> {lang === "es" ? "Español" : "English"}
    </button>
  )
}
