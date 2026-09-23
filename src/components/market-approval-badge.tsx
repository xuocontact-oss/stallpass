import { cn } from "@/lib/utils"

const STYLES = {
  approved: { label: "Live", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Waiting for approval", className: "bg-amber-100 text-amber-900" },
  rejected: { label: "Not approved", className: "bg-red-100 text-red-800" },
}

export function MarketApprovalBadge({ status, published = true }: { status: keyof typeof STYLES; published?: boolean }) {
  const s = status === "approved" && !published ? { label: "Hidden", className: "bg-stone-200 text-stone-700" } : STYLES[status]
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", s.className)}>
      {s.label}
    </span>
  )
}
