"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { logAdminAction } from "@/lib/audit"
import { isAdmin } from "@/lib/auth"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { parseMarketForm } from "@/lib/market-form"
import { runDocumentReminders } from "@/lib/reminders"
import { createClient } from "@/lib/supabase/server"

const NOT_ADMIN = { error: "Only the admin can do that." }

/** Creates or updates a market (admin). */
export async function saveMarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN

  const id = formText(formData, "id")
  if (id && !z.uuid().safeParse(id).success) return { error: "Market not found." }

  const parsed = await parseMarketForm(formData)
  if ("error" in parsed) return parsed
  const { row, contact } = parsed
  const supabase = await createClient()

  let marketId = id
  if (id) {
    const { error } = await supabase.from("markets").update(row).eq("id", id)
    if (error) return { error: friendlyDbError(error) }
  } else {
    const { data, error } = await supabase.from("markets").insert(row).select("id").single()
    if (error) {
      if (error.code === "23505") return { error: "Another market already uses that web address." }
      return { error: friendlyDbError(error) }
    }
    marketId = data.id
  }

  const { error: contactError } = await supabase.from("market_contacts").upsert({ market_id: marketId, ...contact })
  if (contactError) return { error: friendlyDbError(contactError) }

  await logAdminAction(id ? "update_market" : "create_market", "market", marketId, { name: row.name })
  revalidatePath("/markets", "layout")
  revalidatePath("/admin/markets", "layout")
  if (!id) redirect(`/admin/markets/${marketId}?created=1`)
  return { success: "Market saved." }
}

export async function deleteMarket(marketId: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  const supabase = await createClient()

  const { data: photos } = await supabase.from("market_photos").select("path").eq("market_id", marketId)
  const { error } = await supabase.from("markets").delete().eq("id", marketId)
  if (error) return { error: friendlyDbError(error) }
  if (photos?.length) await supabase.storage.from("market-photos").remove(photos.map((p) => p.path))
  await logAdminAction("delete_market", "market", marketId)

  revalidatePath("/markets", "layout")
  redirect("/admin/markets")
}

/** The admin page's "Run reminders now" button. */
export async function runRemindersNow(): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  try {
    const r = await runDocumentReminders()
    await logAdminAction("run_reminders", "system", null, { sent: r.emailsSent })
    const parts = [
      `Checked ${r.documentsChecked} document(s) expiring in the next 30 days.`,
      `Emails sent: ${r.emailsSent}.`,
      r.emailsSkipped ? `Not sent (email not set up): ${r.emailsSkipped}.` : "",
      r.emailsFailed ? `Failed: ${r.emailsFailed}.` : "",
    ]
    return { success: parts.filter(Boolean).join(" ") }
  } catch (e) {
    console.error(e)
    return { error: "The reminder job failed. Check the terminal for details." }
  }
}
