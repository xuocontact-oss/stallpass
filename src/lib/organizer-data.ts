import "server-only"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"
import type { Application, Vendor } from "@/lib/types"

export type OrganizerApplication = Application & {
  vendors: Pick<Vendor, "id" | "business_name" | "category" | "setup_type" | "needs_power" | "needs_water"> | null
}

/** Sent applications to a market the signed-in organizer runs (security rules limit it). */
export async function getMarketApplications(marketId: string): Promise<OrganizerApplication[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("applications")
    .select("*, vendors(id, business_name, category, setup_type, needs_power, needs_water)")
    .eq("market_id", marketId)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false })
  throwIfError(error, "applications")
  return (data ?? []) as OrganizerApplication[]
}
