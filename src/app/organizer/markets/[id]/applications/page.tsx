import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { categoryLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { getMarketApplications } from "@/lib/organizer-data"
import { cn } from "@/lib/utils"

const FILTERS = [
  { key: "submitted", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "waitlisted", label: "Waitlist" },
  { key: "declined", label: "Declined" },
  { key: "cancelled", label: "Cancelled" },
  { key: "", label: "All" },
]

export default async function OrganizerApplicationsPage({ params, searchParams }: PageProps<"/organizer/markets/[id]/applications">) {
  const { id } = await params
  const { status } = await searchParams
  const active = FILTERS.find((f) => f.key === status)?.key ?? "submitted"
  const all = await getMarketApplications(id)
  const apps = active ? all.filter((a) => (active === "accepted" ? ["accepted", "paid"].includes(a.status) : a.status === active)) : all

  return (
    <main className="space-y-4">
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter">
        {FILTERS.map((f) => {
          const n = f.key ? all.filter((a) => (f.key === "accepted" ? ["accepted", "paid"].includes(a.status) : a.status === f.key)).length : all.length
          return (
            <Link
              key={f.key}
              href={`/organizer/markets/${id}/applications${f.key ? `?status=${f.key}` : "?status=all"}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                active === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              {f.label} ({n})
            </Link>
          )
        })}
      </nav>
      {apps.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-background">
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`/organizer/markets/${id}/applications/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.vendors?.business_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {categoryLabel(a.vendors?.category)} · {a.event_dates.map((d) => formatDate(d)).join(", ")}
                    {a.booth_number && ` · Booth ${a.booth_number}`}
                  </p>
                </div>
                <ApplicationStatusBadge status={a.status} />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
