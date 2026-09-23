import "server-only"
import { addDays } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"

export type PartnerRow = {
  id: string
  name: string
  category: string
  commission_terms: string | null
  clicks: number
  uniqueClickers: number
  codeCopies: number
  signups: number
}

/** Counts for every partner in one month ("YYYY-MM"). Admin only (security rules). */
export async function partnerReport(month: string): Promise<PartnerRow[]> {
  const from = `${month}-01`
  const to = addDays(`${month}-28`, 7).slice(0, 7) + "-01" // first day of next month
  const supabase = await createClient()
  const [{ data: partners }, { data: events }] = await Promise.all([
    supabase.from("resources").select("id, name, category, resource_partner_details(commission_terms)").eq("is_partner", true).order("name"),
    supabase
      .from("resource_events")
      .select("resource_id, event, user_id")
      .gte("created_at", from)
      .lt("created_at", to)
      .limit(100000),
  ])
  return (partners ?? []).map((p) => {
    const mine = (events ?? []).filter((e) => e.resource_id === p.id)
    const clicks = mine.filter((e) => e.event === "click")
    const details = p.resource_partner_details as unknown as { commission_terms: string | null } | null
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      commission_terms: details?.commission_terms ?? null,
      clicks: clicks.length,
      uniqueClickers: new Set(clicks.filter((e) => e.user_id).map((e) => e.user_id)).size,
      codeCopies: mine.filter((e) => e.event === "code_copy").length,
      signups: mine.filter((e) => e.event === "signup_reported").length,
    }
  })
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}
