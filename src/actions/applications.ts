"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { attachDocuments, deliverApplication, removeAttachedFiles } from "@/lib/applications"
import { getMyVendor } from "@/lib/auth"
import { MAX_APPLICATIONS_PER_DAY } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { checkReadiness } from "@/lib/readiness"
import { createClient } from "@/lib/supabase/server"
import type { Application, Market, VendorDocument } from "@/lib/types"

const ACTIVE = ["submitted", "accepted", "waitlisted", "paid"]

/** The Quick Apply form: saves a draft or sends the application. */
export async function applyToMarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }

  const marketId = formText(formData, "market_id")
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  const send = formData.get("intent") !== "draft"
  const today = todayISO()
  const supabase = await createClient()

  const { data: marketRow } = await supabase.from("markets").select("*").eq("id", marketId).maybeSingle()
  if (!marketRow) return { error: "Market not found." }
  const market = marketRow as Market

  // Dates must be real, upcoming dates of this market.
  const picked = [...new Set(formData.getAll("dates").map(String))]
  if (picked.length === 0) return { error: "Pick at least one date." }
  if (picked.length > 12) return { error: "Pick up to 12 dates per application." }
  const { data: validDates } = await supabase
    .from("market_dates")
    .select("event_date")
    .eq("market_id", market.id)
    .gte("event_date", today)
    .in("event_date", picked)
  if ((validDates?.length ?? 0) !== picked.length) {
    return { error: "One of those dates isn't available any more. Refresh the page and try again." }
  }
  const eventDates = picked.sort()

  const booth = formText(formData, "booth_choice")
  if (booth && !market.booth_fees.some((f) => f.label === booth)) return { error: "Choose a booth option." }
  const note = formText(formData, "note")
  if (note && note.length > 1000) return { error: "Keep the note under 1,000 characters." }

  // Attached documents (the security rules only return the vendor's own).
  const docIds = formData.getAll("documents").map(String).filter((id) => z.uuid().safeParse(id).success)
  let docs: VendorDocument[] = []
  if (docIds.length) {
    const { data } = await supabase
      .from("vendor_documents")
      .select("*")
      .eq("vendor_id", vendor.id) // the admin can read everyone's, so be explicit
      .in("id", docIds.slice(0, 15))
    docs = (data ?? []) as VendorDocument[]
  }

  // Readiness: sending with problems needs an explicit "send anyway".
  if (send) {
    const { ready } = checkReadiness(market.required_doc_types, docs, eventDates, today)
    if (!ready && formData.get("send_anyway") !== "on") {
      return {
        error:
          "Some required documents are missing, expired, or expire before the event. Attach them, or tick “Send anyway”.",
      }
    }
  }

  // No double-applying for the same date.
  const { data: existing } = await supabase
    .from("applications")
    .select("event_dates, status")
    .eq("vendor_id", vendor.id)
    .eq("market_id", market.id)
    .in("status", ACTIVE)
  const overlap = eventDates.find((d) => existing?.some((a) => a.event_dates.includes(d)))
  if (overlap) return { error: `You already applied for ${formatDate(overlap)}. Pick other dates.` }

  // Stop accidental spam to markets.
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendor.id)
    .gte("created_at", since)
  if ((count ?? 0) >= MAX_APPLICATIONS_PER_DAY) {
    return { error: "That's a lot of applications today! Please try again tomorrow." }
  }

  const { data: app, error } = await supabase
    .from("applications")
    .insert({
      vendor_id: vendor.id,
      market_id: market.id,
      status: "draft",
      event_dates: eventDates,
      booth_choice: booth,
      note,
    })
    .select("id, vendor_id")
    .single()
  if (error) return { error: friendlyDbError(error) }

  try {
    await attachDocuments(app, docs)
  } catch (e) {
    console.error(e)
    return { error: "Couldn't attach your documents. Your draft is saved in Applications; try sending it from there." }
  }

  let notice = "draft"
  if (send) {
    try {
      const result = await deliverApplication(app.id)
      notice = result.via === "email" && !result.emailed ? "email_failed" : result.via
    } catch (e) {
      console.error(e)
      notice = "email_failed"
    }
  }

  revalidatePath("/applications")
  revalidatePath("/dashboard")
  redirect(`/applications/${app.id}?sent=${notice}`)
}

async function loadOwnApplication(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const vendor = await getMyVendor()
  if (!vendor) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  return data as Application | null
}

/** Sends a saved draft, or re-sends an email that didn't go through. */
export async function sendApplication(id: string): Promise<ActionState> {
  const app = await loadOwnApplication(id)
  if (!app) return { error: "Application not found." }
  const canSend = app.status === "draft" || (app.status === "submitted" && app.delivered_via === "email" && !app.emailed_at)
  if (!canSend) return { error: "This application was already sent." }

  try {
    const result = await deliverApplication(app.id)
    revalidatePath(`/applications/${id}`)
    revalidatePath("/applications")
    if (result.via === "platform") return { success: "Sent! The organizer will see it in their dashboard." }
    if (result.via === "not_sent") return { error: result.warning }
    if (!result.emailed) return { error: result.warning ?? "The email didn't go through." }
    return { success: "Sent! The market got an email with your application." }
  } catch (e) {
    console.error(e)
    return { error: "Something went wrong sending it. Please try again." }
  }
}

export async function deleteDraft(id: string): Promise<ActionState> {
  const app = await loadOwnApplication(id)
  if (!app || app.status !== "draft") return { error: "Only drafts can be deleted." }
  await removeAttachedFiles(app.vendor_id, app.id)
  const supabase = await createClient()
  const { error } = await supabase.from("applications").delete().eq("id", id)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/applications")
  return { success: "Draft deleted." }
}

/** Vendor reports what the market said (markets not on Stallpass), or cancels. */
export async function setApplicationStatus(id: string, status: string): Promise<ActionState> {
  if (!z.uuid().safeParse(id).success) return { error: "Application not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("vendor_set_application_status", { app: id, new_status: status })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/applications/${id}`)
  revalidatePath("/applications")
  revalidatePath("/dashboard")
  return { success: "Status updated." }
}
