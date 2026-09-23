import { APPLICATION_STATUSES } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function ApplicationStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = APPLICATION_STATUSES.find((x) => x.key === status)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        s?.className ?? "bg-stone-100",
        className
      )}
    >
      {s?.label ?? status}
    </span>
  )
}
