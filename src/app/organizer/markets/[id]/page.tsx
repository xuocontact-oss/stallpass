import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { categoryLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { getMarketApplications } from "@/lib/organizer-data"
import { createClient } from "@/lib/supabase/server"

export default async function OrganizerMarketOverview({ params }: PageProps<"/organizer/markets/[id]">) {
  const { id } = await params
  const today = todayISO()
  const supabase = await createClient()
  const [apps, { data: dates }] = await Promise.all([
    getMarketApplications(id),
    supabase.from("market_dates").select("event_date").eq("market_id", id).gte("event_date", today).order("event_date").limit(12),
  ])
  const newApps = apps.filter((a) => a.status === "submitted")
  const countFor = (date: string, statuses: string[]) =>
    apps.filter((a) => a.event_dates.includes(date) && statuses.includes(a.status)).length

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-semibold">New applications ({newApps.length})</h2>
        {newApps.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {newApps.slice(0, 8).map((a) => (
              <li key={a.id}>
                <Link href={`/organizer/markets/${id}/applications/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.vendors?.business_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {categoryLabel(a.vendors?.category)} · {a.event_dates.map((d) => formatDate(d)).join(", ")}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={a.status} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {newApps.length > 8 && (
          <Link href={`/organizer/markets/${id}/applications?status=submitted`} className="text-sm font-medium text-primary">
            See all {newApps.length}
          </Link>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Upcoming dates</h2>
        {(dates ?? []).length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            No upcoming dates. <Link href={`/organizer/markets/${id}/edit`} className="text-primary">Add dates</Link>
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {dates!.map((d) => (
              <li key={d.event_date}>
                <Link href={`/organizer/markets/${id}/events/${d.event_date}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 font-medium">{formatDate(d.event_date, { weekday: true })}</span>
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-emerald-700">{countFor(d.event_date, ["accepted", "paid"])} accepted</span>
                    {" · "}
                    {countFor(d.event_date, ["submitted"])} new · {countFor(d.event_date, ["waitlisted"])} waitlist
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
