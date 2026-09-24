"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LANG_COOKIE, LANG_PICKED_COOKIE, type Lang } from "@/lib/i18n/core"
import { useT } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"

const YEAR = 60 * 60 * 24 * 365

/** Saves the choice and re-renders the page in that language (no reload). */
function useSetLang() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  function setLang(lang: Lang) {
    document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${YEAR}; SameSite=Lax`
    document.cookie = `${LANG_PICKED_COOKIE}=1; Path=/; Max-Age=${YEAR}; SameSite=Lax`
    // Clear leftovers from the old page-translator option.
    document.cookie = "lang_other=; Path=/; Max-Age=0"
    document.cookie = "googtrans=; Path=/; Max-Age=0"
    startTransition(() => router.refresh())
  }
  return { setLang, pending }
}

/** First-visit pop-up: English or Español. */
export function LanguagePicker({ hasChosen }: { hasChosen: boolean }) {
  const [open, setOpen] = useState(!hasChosen)
  const { setLang } = useSetLang()

  if (!open) return null
  const choose = (lang: Lang) => {
    setLang(lang)
    setOpen(false)
  }
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your language · Elige tu idioma"
    >
      <div className="w-full max-w-sm animate-in rounded-3xl bg-background p-6 text-center shadow-2xl fade-in slide-in-from-bottom-4">
        <p className="text-xl font-bold">Welcome · Bienvenido</p>
        <p className="mt-1 text-sm text-muted-foreground">Choose your language · Elige tu idioma</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {(
            [
              ["en", "English", "🇺🇸"],
              ["es", "Español", "🇲🇽"],
            ] as const
          ).map(([code, name, flag]) => (
            <button
              key={code}
              type="button"
              onClick={() => choose(code)}
              className="group flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-95"
            >
              <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden>
                {flag}
              </span>
              <span className="font-semibold">{name}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">You can switch any time at the top · Puedes cambiar arriba cuando quieras</p>
      </div>
    </div>
  )
}

/** Green EN | ES switch for the header, with a sliding highlight. */
export function LanguageButton({ className }: { className?: string }) {
  const { lang } = useT()
  const { setLang, pending } = useSetLang()
  return (
    <div
      role="radiogroup"
      aria-label="Language · Idioma"
      className={cn(
        "relative grid h-9 w-[7.5rem] grid-cols-2 rounded-full border-2 border-ink bg-leaf p-0.5 text-sm font-bold",
        pending && "opacity-80",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow transition-transform duration-300 ease-out",
          lang === "es" && "translate-x-full"
        )}
      />
      {(
        [
          ["en", "🇺🇸", "English"],
          ["es", "🇲🇽", "Español"],
        ] as const
      ).map(([code, flag, name]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={lang === code}
          aria-label={name}
          onClick={() => lang !== code && setLang(code)}
          className={cn(
            "relative z-10 flex items-center justify-center gap-1 rounded-full transition-colors",
            lang === code ? "text-leaf" : "text-white hover:text-sun"
          )}
        >
          <span aria-hidden className="text-base leading-none">{flag}</span>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
