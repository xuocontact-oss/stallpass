"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getMyVendor, getOrganizedMarket, isAdmin } from "@/lib/auth"
import { isValidISODate, todayISO, formatDate } from "@/lib/dates"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"
import { parseDollars } from "@/lib/fees"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { disconnectSquare, squareConfigured, squareSalesForDay, type DaySales } from "@/lib/square"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { stateTimeZone } from "@/lib/timezones"

async function ownApplication(appId: string) {
  if (!z.uuid().safeParse(appId).success) return null
  const vendor = await getMyVendor()
  if (!vendor) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("id, vendor_id, market_id, status, event_dates, markets(state, slug)")
    .eq("id", appId)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  return data as { id: string; vendor_id: string; market_id: string; status: string; event_dates: string[]; markets: { state: string; slug: string } } | null
}

/** Vendor reports (or corrects) their sales for one market date. */
export async function saveSalesReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const app = await ownApplication(formText(formData, "application_id") ?? "")
  if (!app) return { error: "Application not found." }
  const date = formText(formData, "event_date") ?? ""
  if (!isValidISODate(date) || !app.event_dates.includes(date)) return { error: "Pick one of your market dates." }
  if (date > todayISO()) return { error: "You can report sales once the market day has happened." }

  const gross = parseDollars(formText(formData, "gross"))
  const card = parseDollars(formText(formData, "card"))
  const cash = parseDollars(formText(formData, "cash"))
  const countText = formText(formData, "transactions")
  const transactions = countText ? Number.parseInt(countText, 10) : null
  if (gross == null || Number.isNaN(gross)) return { error: "Enter your total sales, like 845 or 845.50." }
  if ([card, cash].some((v) => v != null && Number.isNaN(v))) return { error: "Card and cash amounts should look like 500 or 500.25." }
  if (transactions != null && (!Number.isFinite(transactions) || transactions < 0)) return { error: "Number of sales should be a whole number." }
  const notes = formText(formData, "notes")
  if (notes && notes.length > 500) return { error: "Keep notes under 500 characters." }
  const source = formData.get("source") === "square" ? "square" : "manual"

  const fields = {
    gross_sales_cents: gross,
    card_sales_cents: card,
    cash_sales_cents: cash,
    transactions,
    notes,
    source,
  }
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("sales_reports")
    .select("id")
    .eq("application_id", app.id)
    .eq("event_date", date)
    .maybeSingle()
  const { error } = existing
    ? await supabase.from("sales_reports").update(fields).eq("id", existing.id)
    : await supabase.from("sales_reports").insert({
        ...fields,
        application_id: app.id,
        market_id: app.market_id,
        vendor_id: app.vendor_id,
        event_date: date,
      })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/applications/${app.id}`)
  revalidatePath("/dashboard")
  revalidatePath(`/organizer/markets/${app.market_id}`, "layout")
  redirect(`/applications/${app.id}?reported=${date}`)
}

/** "Fill from Square": that day's Square totals, to pre-fill the form. */
export async function fillSalesFromSquare(appId: string, date: string): Promise<{ error?: string; sales?: DaySales }> {
  const app = await ownApplication(appId)
  if (!app || !app.event_dates.includes(date)) return { error: "Application not found." }
  if (!squareConfigured()) return { error: "Square isn't available yet." }
  try {
    const sales = await squareSalesForDay(app.vendor_id, date, stateTimeZone(app.markets.state))
    if (!sales) return { error: "Connect Square first (Profile → Connected apps)." }
    return { sales }
  } catch (e) {
    console.error("Square sales failed:", e)
    return { error: "Couldn't reach Square. Try again, or type the numbers in." }
  }
}

export async function disconnectSquareAction(): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Not signed in." }
  await disconnectSquare(vendor.id)
  revalidatePath("/profile")
  return { success: "Square disconnected." }
}

// ---------------------------------------------------------------------------
// Organizer side
// ---------------------------------------------------------------------------

/** Whether this market asks vendors to report sales, when, and any % fee. */
export async function saveSalesSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const marketId = formText(formData, "market_id") ?? ""
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  if (!(await isAdmin()) && !(await getOrganizedMarket(marketId))) return { error: "You don't run this market." }
  const mode = formText(formData, "sales_reporting") ?? "off"
  if (!["off", "optional", "required"].includes(mode)) return { error: "Choose an option." }
  const days = Number.parseInt(formText(formData, "sales_report_due_days") ?? "3", 10)
  if (!Number.isFinite(days) || days < 1 || days > 30) return { error: "Days to report: 1 to 30." }
  const pctText = formText(formData, "sales_fee_percent")
  const pct = pctText ? Number.parseFloat(pctText) : null
  if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 50)) return { error: "Percent of sales: 0 to 50." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("markets")
    .update({ sales_reporting: mode, sales_report_due_days: days, sales_fee_percent: pct })
    .eq("id", marketId)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/organizer/markets/${marketId}`, "layout")
  revalidatePath(`/admin/markets/${marketId}`)
  return { success: "Sales reporting settings saved." }
}

/** Emails accepted vendors who haven't reported a date yet. */
export async function remindMissingSales(marketId: string, date: string): Promise<ActionState> {
  const market = await getOrganizedMarket(marketId)
  if (!market) return { error: "You don't run this market." }
  if (!isValidISODate(date)) return { error: "Pick a date." }
  const supabase = await createClient()
  const [{ data: apps }, { data: reports }] = await Promise.all([
    supabase.from("applications").select("id, vendor_id").eq("market_id", marketId).in("status", ["accepted", "paid"]).contains("event_dates", [date]),
    supabase.from("sales_reports").select("application_id").eq("market_id", marketId).eq("event_date", date),
  ])
  const reported = new Set((reports ?? []).map((r) => r.application_id))
  const missing = (apps ?? []).filter((a) => !reported.has(a.id))
  if (missing.length === 0) return { success: "Everyone has reported. 🎉" }

  const db = createAdminClient()
  const { data: vendors } = await db
    .from("vendors")
    .select("id, business_name, profiles!vendors_owner_id_fkey(email)")
    .in("id", missing.map((a) => a.vendor_id))
  let sent = 0
  for (const a of missing) {
    const v = (vendors ?? []).find((x) => x.id === a.vendor_id) as unknown as { business_name: string; profiles: { email: string } } | undefined
    if (!v?.profiles?.email) continue
    const url = siteUrl(`/applications/${a.id}/sales?date=${date}`)
    const r = await sendEmail({
      to: v.profiles.email,
      subject: `Please report your sales for ${market.name}`,
      html: emailLayout(
        `<p>Hi ${escapeHtml(v.business_name)},</p><p>${escapeHtml(market.name)} asks vendors to report sales. How did ${escapeHtml(formatDate(date, { weekday: true }))} go? It takes 20 seconds.</p>`,
        { label: "Report my sales", url }
      ),
      text: `${market.name} asks vendors to report sales for ${formatDate(date)}. Report here: ${url}\n`,
    })
    if (r.ok) sent++
  }
  return { success: `Reminded ${sent} vendor${sent === 1 ? "" : "s"}.` }
}
