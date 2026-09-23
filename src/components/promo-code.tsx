"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { recordCodeCopy } from "@/actions/partners"

/** "Code: STALL10 [Copy]" that also counts the copy for partner reporting. */
export function PromoCode({ resourceId, code, page }: { resourceId: string; code: string; page?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(code)
        } catch {
          // Clipboard blocked: the code is still visible to type in.
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        void recordCodeCopy(resourceId, page)
      }}
      className="inline-flex items-center gap-2 rounded-md border border-dashed border-primary/60 bg-secondary px-2.5 py-1 font-mono text-sm font-semibold"
      aria-label={`Copy code ${code}`}
    >
      {code}
      {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-muted-foreground" />}
      <span className="font-sans text-xs font-normal text-muted-foreground">{copied ? "Copied" : "Copy"}</span>
    </button>
  )
}
