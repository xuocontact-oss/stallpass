"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getUser } from "@/lib/auth"
import { isValidISODate, todayISO, addDays } from "@/lib/dates"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

/** Shopper setup (and the account page): name + home ZIP. */
export async function saveShopperProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const parsed = z
    .object({
      full_name: z.string({ error: "Enter your name." }).min(1, "Enter your name.").max(100),
      home_zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code.").nullable(),
    })
    .safeParse({ full_name: formText(formData, "full_name"), home_zip: formText(formData, "home_zip") })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, is_shopper: true })
    .eq("id", user.id)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/", "layout")
  if (formData.get("from") === "onboarding") redirect("/markets")
  return { success: "Saved." }
}

const star = (required: boolean) =>
  required
    ? z.coerce.number({ error: "Give an overall rating (1 to 5 stars)." }).int().min(1, "Give an overall rating (1 to 5 stars).").max(5)
    : z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable())

const shopperReviewSchema = z.object({
  visited_on: z
    .string({ error: "When did you visit?" })
    .refine(isValidISODate, "When did you visit?")
    .refine((d) => d <= todayISO() && d >= addDays(todayISO(), -365), "Pick the date you visited (within the last year)."),
  rating_overall: star(true),
  rating_variety: star(false),
  rating_atmosphere: star(false),
  rating_prices: star(false),
  body: z.string().max(2000, "Keep the review under 2,000 characters.").nullable(),
})

/** A shopper's review of a market (one per market; saving again edits it). */
export async function saveShopperReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in to review." }
  const marketId = formText(formData, "market_id") ?? ""
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  const parsed = shopperReviewSchema.safeParse({
    visited_on: formText(formData, "visited_on"),
    rating_overall: formData.get("rating_overall") ?? 0,
    rating_variety: formData.get("rating_variety"),
    rating_atmosphere: formData.get("rating_atmosphere"),
    rating_prices: formData.get("rating_prices"),
    body: formText(formData, "body"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("shopper_reviews")
    .select("id")
    .eq("market_id", marketId)
    .eq("user_id", user.id)
    .maybeSingle()
  const { error } = existing
    ? await supabase.from("shopper_reviews").update(parsed.data).eq("id", existing.id)
    : await supabase.from("shopper_reviews").insert({ ...parsed.data, market_id: marketId, user_id: user.id })
  if (error) return { error: friendlyDbError(error) }

  const { data: m } = await supabase.from("markets").select("slug").eq("id", marketId).single()
  revalidatePath(`/markets/${m?.slug}`)
  redirect(`/markets/${m?.slug}?reviewed=1#shopper-reviews`)
}

export async function deleteShopperReview(reviewId: string): Promise<ActionState> {
  const user = await getUser()
  if (!user || !z.uuid().safeParse(reviewId).success) return { error: "Review not found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shopper_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .select("id")
  if (error) return { error: friendlyDbError(error) }
  if (!data?.length) return { error: "Review not found." }
  revalidatePath("/markets", "layout")
  revalidatePath("/account")
  return { success: "Review deleted." }
}
