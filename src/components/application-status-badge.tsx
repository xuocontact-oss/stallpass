"use client"

import { APPLICATION_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"

export function ApplicationStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = APPLICATION_STATUSES.find((x) => x.key === status)
  const { t } = useT()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        s?.className ?? "bg-stone-100",
        className
      )}
    >
      {t(s?.label ?? status)}
    </span>
  )
}
