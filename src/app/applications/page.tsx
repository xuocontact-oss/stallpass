import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireVendor } from "@/lib/auth"
import { formatDate, todayISO } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Applications" }

type Row = {
  id: string
  status: string
  event_dates: string[]
  created_at: string
  markets: { name: string; city: string } | null
}

const FILTERS = [
  { key: "", label: "All", statuses: null },
  { key: "accepted", label: "Accepted", statuses: ["accepted", "paid"] },
  { key: "waiting", label: "Waiting", statuses: ["submitted", "waitlisted"] },
  { key: "draft", label: "Drafts", statuses: ["draft"] },
  { key: "declined", label: "Declined", statuses: ["declined", "cancelled"] },
] as const

export default async function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  const { vendor } = await requireVendor()
  const { status } = await searchParams
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, event_dates, created_at, markets(name, city)")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
  throwIfError(error, "your applications")
  const allApps = (data ?? []) as unknown as Row[]
  const apps = filter.statuses ? allApps.filter((a) => (filter.statuses as readonly string[]).includes(a.status)) : allApps
  const today = todayISO()

  const upcoming = apps.filter((a) => a.event_dates.some((d) => d >= today) && a.status !== "cancelled")
  const past = apps.filter((a) => !upcoming.includes(a))

  const list = (rows: Row[]) => (
    <ul className="divide-y rounded-xl border bg-background">
      {rows.map((a) => (
        <li key={a.id}>
          <Link href={`/applications/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.markets?.name}</div>
              <div className="truncate text-sm text-muted-foreground">
                {a.event_dates.map((d) => formatDate(d)).join(", ")}
              </div>
            </div>
            <ApplicationStatusBadge status={a.status} />
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      {allApps.length > 0 && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/applications?status=${f.key}` : "/applications"}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                filter.key === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      )}
      {allApps.length > 0 && apps.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Nothing here.</p>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-6 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Find a market and tap Quick apply.</p>
          <Link href="/markets" className={buttonVariants({ size: "lg", className: "mt-4" })}>
            Find markets
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Upcoming</h2>
              {list(upcoming)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Past & cancelled</h2>
              {list(past)}
            </section>
          )}
        </>
      )}
    </main>
  )
}
