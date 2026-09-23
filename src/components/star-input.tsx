"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/client"

/** Tap-to-rate stars that submit as a normal form field (1–5). */
export function StarInput({ name, label, defaultValue = 0 }: { name: string; label: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue)
  const { t } = useT()
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm font-medium" aria-hidden>
        {label}
      </span>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setValue(i)}
            aria-label={i > 1 ? t("{n} stars", { n: i }) : t("1 star")}
            aria-pressed={value === i}
            className="p-1"
          >
            <Star
              className={cn("size-7", value >= i ? "fill-amber-400 text-amber-400" : "fill-stone-100 text-stone-300")}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </fieldset>
  )
}
