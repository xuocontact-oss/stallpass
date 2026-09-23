"use client"

import { cn } from "@/lib/utils"
import { STATUS_LABELS, type DocStatus } from "@/lib/documents"
import { useT } from "@/lib/i18n/client"

const STYLES: Record<DocStatus, string> = {
  valid: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-900",
  expired: "bg-red-100 text-red-800",
  no_expiry: "bg-stone-100 text-stone-700",
}

export function DocStatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const { t } = useT()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className
      )}
    >
      {t(STATUS_LABELS[status])}
    </span>
  )
}
