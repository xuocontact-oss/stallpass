"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { logAdminAction } from "@/lib/audit"
import { getOrganizedMarket, isAdmin } from "@/lib/auth"
import { isValidISODate } from "@/lib/dates"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { repeatingDates } from "@/lib/markets"
import { createClient } from "@/lib/supabase/server"

/**
 * Dates and photos of a market. Allowed for the admin, and for the market's
 * own organizer. (The database's security rules check the same again.)
 */
async function canManage(marketId: string): Promise<"admin" | "organizer" | null> {
  if (await isAdmin()) return "admin"
  return (await getOrganizedMarket(marketId)) ? "organizer" : null
}

function refresh(marketId: string) {
  revalidatePath(`/admin/markets/${marketId}`)
  revalidatePath(`/organizer/markets/${marketId}`, "layout")
  revalidatePath("/markets", "layout")
}

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Times look like 09:00.")
  .nullable()

/** Adds one date, or a repeating set (e.g. every Sunday through December). */
export async function addMarketDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const marketId = formText(formData, "market_id") ?? ""
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  const who = await canManage(marketId)
  if (!who) return { error: "You can't change this market." }

  const times = z
    .object({ starts_at: timeField, ends_at: timeField })
    .safeParse({ starts_at: formText(formData, "starts_at"), ends_at: formText(formData, "ends_at") })
  if (!times.success) return { error: times.error.issues[0].message }

  const from = formText(formData, "from") ?? ""
  const until = formText(formData, "until")
  const weekdays = formData
    .getAll("weekdays")
    .map((w) => Number(w))
    .filter((w) => Number.isInteger(w) && w >= 0 && w <= 6)

  if (!isValidISODate(from)) return { error: "Pick a date." }
  let dates: string[]
  if (until) {
    if (!isValidISODate(until) || until < from) return { error: "The “repeat until” date must be after the first date." }
    if (weekdays.length === 0) return { error: "Tick at least one day of the week to repeat on." }
    dates = repeatingDates(from, until, weekdays)
    if (dates.length === 0) return { error: "None of those days fall between the two dates." }
  } else {
    dates = [from]
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("market_dates")
    .upsert(
      dates.map((d) => ({ market_id: marketId, event_date: d, ...times.data })),
      { onConflict: "market_id,event_date" }
    )
  if (error) return { error: friendlyDbError(error) }
  if (who === "admin") await logAdminAction("add_market_dates", "market", marketId, { count: dates.length })

  refresh(marketId)
  return { success: dates.length === 1 ? "Date added." : `${dates.length} dates added.` }
}

export async function removeMarketDate(dateId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(dateId).success) return { error: "Date not found." }
  const supabase = await createClient()
  const { data: row } = await supabase.from("market_dates").select("market_id").eq("id", dateId).maybeSingle()
  if (!row || !(await canManage(row.market_id))) return { error: "Date not found." }
  const { error } = await supabase.from("market_dates").delete().eq("id", dateId)
  if (error) return { error: friendlyDbError(error) }
  refresh(row.market_id)
  return { success: "Date removed." }
}

/** Records a photo the browser already uploaded. */
export async function addMarketPhoto(marketId: string, path: string): Promise<ActionState> {
  if (!z.uuid().safeParse(marketId).success || typeof path !== "string" || !path.startsWith(`${marketId}/`)) {
    return { error: "That upload didn't work. Please try again." }
  }
  if (!(await canManage(marketId))) return { error: "You can't change this market." }
  const supabase = await createClient()
  const { count } = await supabase
    .from("market_photos")
    .select("id", { count: "exact", head: true })
    .eq("market_id", marketId)
  if ((count ?? 0) >= 8) {
    await supabase.storage.from("market-photos").remove([path])
    return { error: "Up to 8 photos. Remove one first." }
  }
  const { error } = await supabase.from("market_photos").insert({ market_id: marketId, path, position: count ?? 0 })
  if (error) return { error: friendlyDbError(error) }
  refresh(marketId)
  return { success: "Photo added." }
}

export async function removeMarketPhoto(photoId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(photoId).success) return { error: "Photo not found." }
  const supabase = await createClient()
  const { data: row } = await supabase.from("market_photos").select("market_id, path").eq("id", photoId).maybeSingle()
  if (!row || !(await canManage(row.market_id))) return { error: "Photo not found." }
  const { error } = await supabase.from("market_photos").delete().eq("id", photoId)
  if (error) return { error: friendlyDbError(error) }
  await supabase.storage.from("market-photos").remove([row.path])
  refresh(row.market_id)
  return { success: "Photo removed." }
}
