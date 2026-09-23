"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getMyVendor } from "@/lib/auth"
import { SALES_RANGES } from "@/lib/constants"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

const rating = z.coerce
  .number({ error: "Rate every category (1 to 5 stars)." })
  .int()
  .min(1, "Rate every category (1 to 5 stars).")
  .max(5)

const reviewSchema = z.object({
  rating_foot_traffic: rating,
  rating_organization: rating,
  rating_value: rating,
  rating_overall: rating,
  sales_range: z.enum(SALES_RANGES.map((s) => s.key)).nullable(),
  body: z.string().max(3000, "Keep the review under 3,000 characters.").nullable(),
})

/** Writes (or updates) the vendor's review of one market date. */
export async function saveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }

  const parsed = reviewSchema.safeParse({
    rating_foot_traffic: formData.get("rating_foot_traffic") ?? 0,
    rating_organization: formData.get("rating_organization") ?? 0,
    rating_value: formData.get("rating_value") ?? 0,
    rating_overall: formData.get("rating_overall") ?? 0,
    sales_range: formText(formData, "sales_range"),
    body: formText(formData, "body"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const reviewId = formText(formData, "review_id")

  if (reviewId) {
    if (!z.uuid().safeParse(reviewId).success) return { error: "Review not found." }
    const { data, error } = await supabase
      .from("reviews")
      .update(parsed.data)
      .eq("id", reviewId)
      .eq("vendor_id", vendor.id)
      .select("market_id")
      .maybeSingle()
    if (error) return { error: friendlyDbError(error) }
    if (!data) return { error: "Review not found." }
    revalidatePath("/markets", "layout")
    return { success: "Review updated." }
  }

  const applicationId = formText(formData, "application_id")
  const eventDate = formText(formData, "event_date")
  if (!z.uuid().safeParse(applicationId).success || !eventDate) return { error: "Choose which market date you're reviewing." }

  const { data: app } = await supabase
    .from("applications")
    .select("market_id")
    .eq("id", applicationId)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  if (!app) return { error: "Application not found." }

  const { error } = await supabase.from("reviews").insert({
    ...parsed.data,
    vendor_id: vendor.id,
    market_id: app.market_id,
    application_id: applicationId,
    event_date: eventDate,
  })
  if (error) {
    if (error.code === "23505") return { error: "You've already reviewed that date. You can edit your review instead." }
    if (error.code === "42501") {
      return { error: "You can review a market date once it has passed and your acceptance is confirmed." }
    }
    return { error: friendlyDbError(error) }
  }
  revalidatePath("/markets", "layout")
  revalidatePath(`/applications/${applicationId}`)
  redirect(`/applications/${applicationId}?reviewed=1`)
}

export async function deleteReview(reviewId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(reviewId).success) return { error: "Review not found." }
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Review not found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("vendor_id", vendor.id)
    .select("application_id")
    .maybeSingle()
  if (error) return { error: friendlyDbError(error) }
  if (!data) return { error: "Review not found." }
  revalidatePath("/markets", "layout")
  if (data.application_id) revalidatePath(`/applications/${data.application_id}`)
  return { success: "Review deleted." }
}
