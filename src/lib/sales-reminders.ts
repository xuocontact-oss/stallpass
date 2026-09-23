import "server-only"
import { addDays, formatDate, todayISO } from "@/lib/dates"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * The day after a market (for markets that collect sales), one email to each
 * accepted vendor who hasn't reported yet. Never sent twice for the same day.
 */
export async function runSalesReminders(budget: number): Promise<{ sent: number }> {
  if (budget <= 0) return { sent: 0 }
  const db = createAdminClient()
  const today = todayISO()
  const from = addDays(today, -7)
  const yesterday = addDays(today, -1)

  const { data: apps } = await db
    .from("applications")
    .select("id, event_dates, markets!inner(name, sales_reporting), vendors!inner(business_name, is_sample, profiles!vendors_owner_id_fkey(email, suspended_at))")
    .in("status", ["accepted", "paid"])
    .neq("markets.sales_reporting", "off")
    .limit(2000)

  type Row = {
    id: string
    event_dates: string[]
    markets: { name: string; sales_reporting: string }
    vendors: { business_name: string; is_sample: boolean; profiles: { email: string; suspended_at: string | null } | null }
  }
  const due = ((apps ?? []) as unknown as Row[]).flatMap((a) =>
    a.event_dates.filter((d) => d >= from && d <= yesterday).map((d) => ({ app: a, date: d }))
  )
  if (due.length === 0) return { sent: 0 }

  const ids = [...new Set(due.map((x) => x.app.id))]
  const [{ data: reports }, { data: reminded }] = await Promise.all([
    db.from("sales_reports").select("application_id, event_date").in("application_id", ids),
    db.from("sales_report_reminders").select("application_id, event_date").in("application_id", ids),
  ])
  const done = new Set([...(reports ?? []), ...(reminded ?? [])].map((r) => `${r.application_id}:${r.event_date}`))

  let sent = 0
  for (const { app, date } of due) {
    if (sent >= budget) break
    const email = app.vendors.profiles?.email
    if (!email || app.vendors.is_sample || app.vendors.profiles?.suspended_at || done.has(`${app.id}:${date}`)) continue
    // Record first, so it can never go out twice.
    const { error } = await db.from("sales_report_reminders").insert({ application_id: app.id, event_date: date })
    if (error) continue
    const url = siteUrl(`/applications/${app.id}/sales?date=${date}`)
    const required = app.markets.sales_reporting === "required"
    const r = await sendEmail({
      to: email,
      subject: `How did ${app.markets.name} go?`,
      html: emailLayout(
        `<p>Hi ${escapeHtml(app.vendors.business_name)},</p><p>${required ? `${escapeHtml(app.markets.name)} asks every vendor to report sales.` : "Keep track of how each market day went."} How was ${escapeHtml(formatDate(date, { weekday: true }))}? It takes 20 seconds, or one tap if you've connected Square.</p>`,
        { label: "Report my sales", url }
      ),
      text: `How was ${app.markets.name} on ${formatDate(date)}? Report your sales: ${url}\n`,
    })
    if (r.ok) sent++
  }
  return { sent }
}
