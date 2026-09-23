import "server-only"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"

export type DaySummary = {
  date: string
  accepted: number
  reported: number
  totalCents: number
  rows: { applicationId: string; business: string; booth: string | null; gross: number | null; card: number | null; cash: number | null; transactions: number | null; source: string | null }[]
}

/** Sales per market day for the organizer (security rules limit it to their markets). */
export async function marketSalesByDay(marketId: string, onlyDate?: string): Promise<DaySummary[]> {
  const supabase = await createClient()
  const today = todayISO()
  const [{ data: apps }, { data: reports }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, event_dates, booth_number, vendors(business_name)")
      .eq("market_id", marketId)
      .in("status", ["accepted", "paid"]),
    supabase.from("sales_reports").select("*").eq("market_id", marketId),
  ])
  const days = new Map<string, DaySummary>()
  for (const a of (apps ?? []) as unknown as { id: string; event_dates: string[]; booth_number: string | null; vendors: { business_name: string } | null }[]) {
    for (const d of a.event_dates) {
      if (d > today || (onlyDate && d !== onlyDate)) continue
      const day = days.get(d) ?? { date: d, accepted: 0, reported: 0, totalCents: 0, rows: [] }
      const r = (reports ?? []).find((x) => x.application_id === a.id && x.event_date === d)
      day.accepted++
      if (r) {
        day.reported++
        day.totalCents += r.gross_sales_cents
      }
      day.rows.push({
        applicationId: a.id,
        business: a.vendors?.business_name ?? "Vendor",
        booth: a.booth_number,
        gross: r?.gross_sales_cents ?? null,
        card: r?.card_sales_cents ?? null,
        cash: r?.cash_sales_cents ?? null,
        transactions: r?.transactions ?? null,
        source: r?.source ?? null,
      })
      days.set(d, day)
    }
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
