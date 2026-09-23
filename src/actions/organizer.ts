"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getOrganizedMarket, getUser } from "@/lib/auth"
import { isValidISODate } from "@/lib/dates"
import { sendEmail } from "@/lib/email"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { parseMarketForm } from "@/lib/market-form"
import { broadcastEmail, decisionEmail } from "@/lib/organizer-emails"
import { createAdminClient, createClient } from "@/lib/supabase/server"

const NOT_YOURS = { error: "You don't run this market." }

/** "I run a market": turns on organizer tools for this account. */
export async function becomeOrganizer(next?: string): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ is_organizer: true }).eq("id", user.id)
  if (error) return { error: friendlyDbError(error) }
  redirect(next && next.startsWith("/claim/") ? next : "/organizer")
}

/** Organizer creates a brand-new market (goes to admin approval unless trusted). */
export async function createOrganizerMarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const parsed = await parseMarketForm(formData)
  if ("error" in parsed) return parsed

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("markets")
    .insert({ ...parsed.row, organizer_id: user.id })
    .select("id, approval_status")
    .single()
  if (error) {
    if (error.code === "23505") return { error: "Another market already uses that web address. Change the name slightly." }
    if (error.code === "42501") return { error: "Tap “I run a market” on your organizer page first." }
    return { error: friendlyDbError(error) }
  }
  // Applications from vendors reach organizers in their dashboard; keep their
  // email on file for notifications.
  await supabase.from("market_contacts").upsert({ market_id: data.id, contact_email: user.email })
  revalidatePath("/organizer")
  redirect(`/organizer/markets/${data.id}/edit?created=${data.approval_status}`)
}

export async function updateOrganizerMarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formText(formData, "id") ?? ""
  const market = await getOrganizedMarket(id)
  if (!market) return NOT_YOURS
  const parsed = await parseMarketForm(formData)
  if ("error" in parsed) return parsed

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("markets")
    .update(parsed.row)
    .eq("id", id)
    .select("approval_status")
    .single()
  if (error) {
    if (error.code === "23505") return { error: "Another market already uses that web address." }
    return { error: friendlyDbError(error) }
  }
  revalidatePath(`/organizer/markets/${id}`, "layout")
  revalidatePath("/markets", "layout")
  return {
    success:
      market.approval_status === "rejected" && data.approval_status === "pending"
        ? "Saved and sent back for approval."
        : "Market saved.",
  }
}

export async function deleteOrganizerMarket(marketId: string): Promise<ActionState> {
  const market = await getOrganizedMarket(marketId)
  if (!market) return NOT_YOURS
  if (market.approval_status === "approved") return { error: "Live markets can't be deleted. Hide it instead, or ask Stallpass." }
  const supabase = await createClient()
  const { error } = await supabase.from("markets").delete().eq("id", marketId)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/organizer")
  redirect("/organizer")
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export async function submitClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const parsed = z
    .object({
      market_id: z.uuid(),
      role: z.string({ error: "Tell us your role at the market." }).min(1, "Tell us your role at the market.").max(100),
      message: z.string().max(1000).nullable(),
      evidence_url: z.string().max(300).nullable(),
    })
    .safeParse({
      market_id: formText(formData, "market_id"),
      role: formText(formData, "role"),
      message: formText(formData, "message"),
      evidence_url: formText(formData, "evidence_url"),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  await supabase.from("profiles").update({ is_organizer: true }).eq("id", user.id)
  const { error } = await supabase.from("market_claims").insert({ ...parsed.data, user_id: user.id })
  if (error) {
    if (error.code === "23505") return { error: "You've already asked to claim this market. We'll be in touch." }
    if (error.code === "42501") return { error: "This market already has an organizer on Stallpass." }
    return { error: friendlyDbError(error) }
  }
  revalidatePath("/organizer")
  redirect("/organizer?claimed=1")
}

export async function withdrawClaim(claimId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(claimId).success) return { error: "Claim not found." }
  const supabase = await createClient()
  const { data, error } = await supabase.from("market_claims").delete().eq("id", claimId).select("id")
  if (error) return { error: friendlyDbError(error) }
  if (!data?.length) return { error: "Claim not found." }
  revalidatePath("/organizer")
  return { success: "Claim withdrawn." }
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

async function loadApplicationForOrganizer(appId: string) {
  if (!z.uuid().safeParse(appId).success) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("id, market_id, vendor_id, status, event_dates, booth_number")
    .eq("id", appId)
    .maybeSingle()
  if (!data) return null
  const market = await getOrganizedMarket(data.market_id)
  return market ? { app: data, market } : null
}

/** Accept / waitlist / decline. Emails the vendor unless "notify" is off. */
export async function decideApplication(
  appId: string,
  status: "accepted" | "waitlisted" | "declined" | "submitted",
  message?: string,
  notify = true
): Promise<ActionState> {
  const found = await loadApplicationForOrganizer(appId)
  if (!found) return { error: "Application not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("organizer_set_application_status", {
    app: appId,
    new_status: status,
    message: message?.slice(0, 1000) ?? "",
  })
  if (error) return { error: friendlyDbError(error) }

  let emailNote = ""
  if (notify && status !== "submitted") {
    // The vendor's email isn't visible to organizers, so look it up with full
    // access now that we've confirmed this organizer runs the market.
    const db = createAdminClient()
    const { data: v } = await db
      .from("vendors")
      .select("business_name, profiles!vendors_owner_id_fkey(email)")
      .eq("id", found.app.vendor_id)
      .single()
    const to = (v as unknown as { profiles: { email: string } } | null)?.profiles?.email
    const organizerEmail = (await getUser())?.email
    if (v && to) {
      const sent = await sendEmail({
        to,
        replyTo: organizerEmail,
        ...decisionEmail({
          status,
          marketName: found.market.name,
          businessName: v.business_name,
          dates: found.app.event_dates,
          booth: found.app.booth_number,
          note: message?.trim() || null,
          applicationId: appId,
        }),
      })
      emailNote = sent.ok ? " We emailed the vendor." : " (The email to the vendor didn't go out.)"
    }
  }

  revalidatePath(`/organizer/markets/${found.market.id}`, "layout")
  const label = { accepted: "Accepted.", waitlisted: "Waitlisted.", declined: "Declined.", submitted: "Moved back to new." }[status]
  return { success: label + emailNote }
}

export async function setBooth(appId: string, booth: string): Promise<ActionState> {
  const found = await loadApplicationForOrganizer(appId)
  if (!found) return { error: "Application not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("organizer_set_booth", { app: appId, booth: booth.slice(0, 20) })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/organizer/markets/${found.market.id}`, "layout")
  return { success: booth.trim() ? `Booth ${booth.trim()} saved.` : "Booth cleared." }
}

const MAX_MESSAGES_PER_DAY = 10

/** Emails every accepted vendor for one date (or all upcoming dates). */
export async function messageVendors(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const marketId = formText(formData, "market_id") ?? ""
  const market = await getOrganizedMarket(marketId)
  if (!market) return NOT_YOURS
  const eventDate = formText(formData, "event_date")
  if (eventDate && !isValidISODate(eventDate)) return { error: "Pick a date." }
  const subject = formText(formData, "subject")
  const body = formText(formData, "body")
  if (!subject || subject.length > 150) return { error: "Add a subject (under 150 characters)." }
  if (!body || body.length > 5000) return { error: "Write a message (under 5,000 characters)." }

  const supabase = await createClient()
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase
    .from("organizer_messages")
    .select("id", { count: "exact", head: true })
    .eq("market_id", marketId)
    .gte("created_at", since)
  if ((count ?? 0) >= MAX_MESSAGES_PER_DAY) return { error: "That's the limit of 10 messages a day for this market." }

  let query = supabase
    .from("applications")
    .select("vendor_id")
    .eq("market_id", marketId)
    .in("status", ["accepted", "paid"])
  if (eventDate) query = query.contains("event_dates", [eventDate])
  const { data: apps } = await query
  const vendorIds = [...new Set((apps ?? []).map((a) => a.vendor_id))]
  if (vendorIds.length === 0) return { error: "No accepted vendors for that date yet." }

  const db = createAdminClient()
  const { data: vendors } = await db
    .from("vendors")
    .select("profiles!vendors_owner_id_fkey(email)")
    .in("id", vendorIds)
  const emails = (vendors ?? [])
    .map((v) => (v as unknown as { profiles: { email: string } | null }).profiles?.email)
    .filter(Boolean) as string[]

  const user = await getUser()
  const email = broadcastEmail({ marketName: market.name, eventDate, subject, body })
  let sent = 0
  for (const to of emails) {
    const result = await sendEmail({ to, replyTo: user?.email, ...email })
    if (result.ok) sent++
  }
  await supabase.from("organizer_messages").insert({
    market_id: marketId,
    event_date: eventDate,
    sent_by: user?.id,
    subject,
    body,
    recipient_count: sent,
  })

  revalidatePath(`/organizer/markets/${marketId}`, "layout")
  if (sent === 0) return { error: "The emails didn't go out. Check that email is set up, then try again." }
  return { success: `Sent to ${sent} vendor${sent === 1 ? "" : "s"}.` }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function replyToReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reviewId = formText(formData, "review_id") ?? ""
  if (!z.uuid().safeParse(reviewId).success) return { error: "Review not found." }
  const reply = formText(formData, "reply") ?? ""
  if (reply.length > 2000) return { error: "Keep replies under 2,000 characters." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("reply_to_review", { review: reviewId, reply })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/organizer", "layout")
  revalidatePath("/markets", "layout")
  return { success: reply ? "Reply posted publicly." : "Reply removed." }
}

export async function replyToShopperReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reviewId = formText(formData, "review_id") ?? ""
  if (!z.uuid().safeParse(reviewId).success) return { error: "Review not found." }
  const reply = formText(formData, "reply") ?? ""
  if (reply.length > 2000) return { error: "Keep replies under 2,000 characters." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("reply_to_shopper_review", { review: reviewId, reply })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/organizer", "layout")
  revalidatePath("/markets", "layout")
  return { success: reply ? "Reply posted publicly." : "Reply removed." }
}
