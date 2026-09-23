import "server-only"
import { getUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"

export type ResourceEvent = "click" | "code_copy" | "signup_reported"

/** Records a click / code copy / "I signed up" for partner reporting. */
export async function logResourceEvent(resourceId: string, event: ResourceEvent, page?: string | null) {
  const user = await getUser()
  const { error } = await createAdminClient()
    .from("resource_events")
    .insert({
      resource_id: resourceId,
      event,
      user_id: user?.id ?? null,
      page: page?.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || null,
    })
  // A repeat "I signed up" is simply ignored.
  if (error && error.code !== "23505") console.error("Resource event failed:", error)
  return !error
}

/** Which resource section helps with each document type (for "get it here" offers). */
export const CATEGORY_FOR_DOC: Record<string, string> = {
  liability_insurance: "insurance",
  health_permit: "health_permit",
  food_handler_card: "food_handler",
  sellers_permit: "sellers_permit",
  business_license: "business_license",
}

/**
 * The partner to suggest for each document type a vendor is missing, e.g.
 * { liability_insurance: <insurance partner> }. First partner per section wins
 * (set the order in Admin → Start hub).
 */
export async function getPartnerOffers(): Promise<Record<string, import("@/lib/types").Resource>> {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const { data } = await supabase
    .from("resources")
    .select("*")
    .eq("is_published", true)
    .eq("is_partner", true)
    .order("position")
  const offers: Record<string, import("@/lib/types").Resource> = {}
  for (const [docType, category] of Object.entries(CATEGORY_FOR_DOC)) {
    const match = (data ?? []).find((r) => r.category === category)
    if (match) offers[docType] = match
  }
  return offers
}
