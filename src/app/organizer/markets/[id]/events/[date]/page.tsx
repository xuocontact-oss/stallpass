import Link from "next/link"
import { notFound } from "next/navigation"
import { Droplets, Plug } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { BoothInput } from "@/components/organizer/booth-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { messageVendors } from "@/actions/organizer"
import { categoryLabel, setupTypeLabel } from "@/lib/constants"
import { formatDate, isValidISODate } from "@/lib/dates"
import { getMarketApplications } from "@/lib/organizer-data"
import { createClient } from "@/lib/supabase/server"

/** Everything for one market day: who's coming, booth numbers, and a message to all of them. */
export default async function OrganizerEventPage({ params }: PageProps<"/organizer/markets/[id]/events/[date]">) {
  const { id, date } = await params
  if (!isValidISODate(date)) notFound()
  const supabase = await createClient()
  const [all, { data: messages }] = await Promise.all([
    getMarketApplications(id),
    supabase
      .from("organizer_messages")
      .select("id, subject, recipient_count, created_at")
      .eq("market_id", id)
      .eq("event_date", date)
      .order("created_at", { ascending: false }),
  ])
  const forDay = all.filter((a) => a.event_dates.includes(date))
  const accepted = forDay
    .filter((a) => ["accepted", "paid"].includes(a.status))
    .sort((a, b) => (a.booth_number ?? "zzz").localeCompare(b.booth_number ?? "zzz", undefined, { numeric: true }))
  const waiting = forDay.filter((a) => ["submitted", "waitlisted"].includes(a.status))
  const powerCount = accepted.filter((a) => a.vendors?.needs_power).length
  const waterCount = accepted.filter((a) => a.vendors?.needs_water).length

  return (
    <main className="space-y-5">
      <Link href={`/organizer/markets/${id}`} className="text-sm text-muted-foreground">← Overview</Link>
      <div>
        <h2 className="text-xl font-bold">{formatDate(date, { weekday: true })}</h2>
        <p className="text-sm text-muted-foreground">
          {accepted.length} vendor{accepted.length === 1 ? "" : "s"} coming · {powerCount} need power · {waterCount} need water
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">Booth list</h3>
        {accepted.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No accepted vendors for this date yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {accepted.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <BoothInput appId={a.id} value={a.booth_number} />
                <Link href={`/organizer/markets/${id}/applications/${a.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate font-medium">{a.vendors?.business_name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    {categoryLabel(a.vendors?.category)} · {setupTypeLabel(a.vendors?.setup_type)}
                    {a.vendors?.needs_power && <Plug className="size-3.5" aria-label="Needs power" />}
                    {a.vendors?.needs_water && <Droplets className="size-3.5" aria-label="Needs water" />}
                  </p>
                </Link>
                {a.status === "paid" ? (
                  <ApplicationStatusBadge status="paid" />
                ) : (
                  <span className="text-xs text-muted-foreground">Not paid</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Still to decide ({waiting.length})</h3>
          <ul className="divide-y rounded-xl border bg-background">
            {waiting.map((a) => (
              <li key={a.id}>
                <Link href={`/organizer/markets/${id}/applications/${a.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 truncate font-medium">{a.vendors?.business_name}</span>
                  <ApplicationStatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <div>
          <h3 className="font-semibold">Message all {accepted.length} accepted vendors</h3>
          <p className="text-sm text-muted-foreground">Sent by email. Their replies come straight to you.</p>
        </div>
        <ActionForm action={messageVendors} resetOnSuccess className="space-y-3">
          <input type="hidden" name="market_id" value={id} />
          <input type="hidden" name="event_date" value={date} />
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" maxLength={150} required placeholder="Load-in details for Saturday" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" rows={5} maxLength={5000} required />
          </div>
          <SubmitButton disabled={accepted.length === 0} pendingText="Sending…">
            Send to {accepted.length} vendor{accepted.length === 1 ? "" : "s"}
          </SubmitButton>
        </ActionForm>
        {(messages ?? []).length > 0 && (
          <ul className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
            {messages!.map((m) => (
              <li key={m.id}>
                Sent &ldquo;{m.subject}&rdquo; to {m.recipient_count} · {formatDate(m.created_at.slice(0, 10))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
