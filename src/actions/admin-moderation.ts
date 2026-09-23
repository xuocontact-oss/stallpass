"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isAdmin } from "@/lib/auth"
import { deleteAccountCompletely } from "@/lib/account-deletion"
import { logAdminAction } from "@/lib/audit"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"
import { friendlyDbError, type ActionState } from "@/lib/form"
import { createAdminClient, createClient } from "@/lib/supabase/server"

const NOT_ADMIN = { error: "Only the admin can do that." }

function simpleEmail(subject: string, body: string, button?: { label: string; url: string }) {
  return {
    subject,
    html: emailLayout(`<p>${escapeHtml(body)}</p>`, button),
    text: `${body}${button ? `\n\n${button.label}: ${button.url}` : ""}\n`,
  }
}

/** Confirms a vendor-reported acceptance is real, so they can review. (Logged.) */
export async function verifyApplication(id: string, verified: boolean): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(id).success) return { error: "Application not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_verify_application", { app: id, verified })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/admin/applications")
  return { success: verified ? "Verified. The vendor can now review." : "Verification removed." }
}

/** Hides an abusive review from the public, or restores it. (Logged.) */
export async function setReviewHidden(id: string, hidden: boolean, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(id).success) return { error: "Review not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_review_hidden", {
    review: id,
    hidden,
    reason: reason?.slice(0, 300) ?? "",
  })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/admin/reviews")
  revalidatePath("/markets", "layout")
  return { success: hidden ? "Review hidden from the public." : "Review restored." }
}

/** Approve or reject a market an organizer created. Emails the organizer. (Logged.) */
export async function reviewMarket(id: string, approve: boolean, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(id).success) return { error: "Market not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_review_market", { market: id, approve, reason: reason?.slice(0, 500) ?? "" })
  if (error) return { error: friendlyDbError(error) }

  const db = createAdminClient()
  const { data: m } = await db
    .from("markets")
    .select("name, slug, organizer_id, profiles!markets_organizer_id_fkey(email)")
    .eq("id", id)
    .single()
  const to = (m as unknown as { profiles: { email: string } | null } | null)?.profiles?.email
  if (m && to) {
    await sendEmail({
      to,
      ...(approve
        ? simpleEmail(`${m.name} is live on Stallpass`, `Good news: ${m.name} is approved and now visible to vendors.`, {
            label: "Open your market",
            url: siteUrl(`/organizer/markets/${id}`),
          })
        : simpleEmail(
            `${m.name} wasn't approved yet`,
            `We couldn't approve ${m.name}${reason ? ` because: ${reason}` : "."} Fix it and save to send it back.`,
            { label: "Edit your listing", url: siteUrl(`/organizer/markets/${id}/edit`) }
          )),
    })
  }
  revalidatePath("/admin/approvals")
  revalidatePath("/markets", "layout")
  return { success: approve ? "Approved. It's live." : "Rejected. The organizer was told why." }
}

/** Approve or reject a claim on an existing market. Emails the claimer. (Logged.) */
export async function decideClaim(id: string, approve: boolean, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(id).success) return { error: "Claim not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_decide_claim", { claim: id, approve, reason: reason?.slice(0, 500) ?? "" })
  if (error) return { error: friendlyDbError(error) }

  const db = createAdminClient()
  const { data: c } = await db
    .from("market_claims")
    .select("market_id, markets(name), profiles!market_claims_user_id_fkey(email)")
    .eq("id", id)
    .single()
  const claim = c as unknown as { market_id: string; markets: { name: string }; profiles: { email: string } } | null
  if (claim?.profiles?.email) {
    await sendEmail({
      to: claim.profiles.email,
      ...(approve
        ? simpleEmail(`You now manage ${claim.markets.name} on Stallpass`, `Your claim was approved. New applications will arrive in your dashboard.`, {
            label: "Open your dashboard",
            url: siteUrl(`/organizer/markets/${claim.market_id}`),
          })
        : simpleEmail(
            `About your claim for ${claim.markets.name}`,
            `We couldn't confirm your claim${reason ? `: ${reason}` : "."} Reply to this email if you think that's a mistake.`
          )),
    })
  }
  revalidatePath("/admin/approvals")
  return { success: approve ? "Claim approved." : "Claim rejected." }
}

export async function setTrustedOrganizer(userId: string, trusted: boolean): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(userId).success) return { error: "Account not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_trusted_organizer", { uid: userId, trusted })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/admin/accounts")
  return { success: trusted ? "Trusted: their new markets go live without approval." : "No longer trusted." }
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  const parsed = z
    .object({
      auto_approve_min_rating: z.coerce.number().min(1).max(5),
      auto_approve_min_reviews: z.coerce.number().int().min(1).max(1000),
    })
    .safeParse({
      auto_approve_min_rating: formData.get("auto_approve_min_rating"),
      auto_approve_min_reviews: formData.get("auto_approve_min_reviews"),
    })
  if (!parsed.success) return { error: "Rating must be 1–5 and reviews at least 1." }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const { error } = await supabase
    .from("platform_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: claims?.claims?.sub })
    .eq("id", 1)
  if (error) return { error: friendlyDbError(error) }
  await logAdminAction("update_settings", "settings", null, parsed.data)
  revalidatePath("/admin/settings")
  return { success: "Settings saved." }
}

export async function updateFeeSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  const parsed = z
    .object({
      platform_fee_percent: z.coerce.number().min(0).max(50),
      platform_fee_flat_dollars: z.coerce.number().min(0).max(100),
    })
    .safeParse({
      platform_fee_percent: formData.get("platform_fee_percent"),
      platform_fee_flat_dollars: formData.get("platform_fee_flat_dollars"),
    })
  if (!parsed.success) return { error: "Percent must be 0–50 and the flat fee $0–100." }
  const values = {
    platform_fee_percent: Math.round(parsed.data.platform_fee_percent * 100) / 100,
    platform_fee_flat_cents: Math.round(parsed.data.platform_fee_flat_dollars * 100),
  }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const { error } = await supabase
    .from("platform_settings")
    .update({ ...values, updated_at: new Date().toISOString(), updated_by: claims?.claims?.sub })
    .eq("id", 1)
  if (error) return { error: friendlyDbError(error) }
  await logAdminAction("update_platform_fee", "settings", null, values)
  revalidatePath("/admin/settings")
  return { success: "Platform fee saved. It applies to new payments." }
}

export async function setShopperReviewHidden(id: string, hidden: boolean, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(id).success) return { error: "Review not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_shopper_review_hidden", { review: id, hidden, reason: reason?.slice(0, 300) ?? "" })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/admin/reviews")
  revalidatePath("/markets", "layout")
  return { success: hidden ? "Review hidden from the public." : "Review restored." }
}

export async function setSuspended(userId: string, suspended: boolean, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(userId).success) return { error: "Account not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_suspended", { uid: userId, suspended, reason: reason?.slice(0, 300) ?? "" })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/admin", "layout")
  return { success: suspended ? "Account suspended." : "Account restored." }
}

/** Permanently deletes someone's account (e.g. on request, or for abuse). Logged first. */
export async function adminDeleteAccount(userId: string, reason?: string): Promise<ActionState> {
  if (!(await isAdmin())) return NOT_ADMIN
  if (!z.uuid().safeParse(userId).success) return { error: "Account not found." }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (claims?.claims?.sub === userId) return { error: "You can't delete your own admin account here." }
  const { data: target } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle()
  if (!target) return { error: "Account not found." }
  await logAdminAction("delete_account", "profile", userId, { email: target.email, reason: reason ?? null })
  try {
    await deleteAccountCompletely(userId)
  } catch (e) {
    console.error(e)
    return { error: "Deleting failed. Try again." }
  }
  revalidatePath("/admin", "layout")
  return { success: `Deleted ${target.email}.` }
}
