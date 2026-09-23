import "server-only"
import { randomBytes } from "node:crypto"
import { buildApplicationEmail } from "@/lib/application-email"
import { SHARE_LINK_DAYS } from "@/lib/constants"
import { newApplicationEmail } from "@/lib/organizer-emails"
import { sendEmail, siteUrl } from "@/lib/email"
import { createAdminClient } from "@/lib/supabase/server"
import type { Application, Market, Vendor, VendorDocument } from "@/lib/types"

/**
 * Copies the chosen documents into the application, so the market sees
 * exactly what was attached even if the vendor edits or deletes them later.
 * Runs with full access AFTER the caller has checked the vendor owns both the
 * application and the documents.
 */
export async function attachDocuments(application: Pick<Application, "id" | "vendor_id">, docs: VendorDocument[]) {
  const db = createAdminClient()
  for (const doc of docs) {
    const ext = doc.file_path.includes(".") ? doc.file_path.slice(doc.file_path.lastIndexOf(".")) : ""
    const copyPath = `${application.vendor_id}/applications/${application.id}/${crypto.randomUUID()}${ext}`
    const { error: copyError } = await db.storage.from("vendor-documents").copy(doc.file_path, copyPath)
    if (copyError) throw new Error(`Couldn't copy ${doc.file_name}: ${copyError.message}`)
    const { error } = await db.from("application_documents").insert({
      application_id: application.id,
      source_document_id: doc.id,
      doc_type: doc.doc_type,
      title: doc.title,
      file_path: copyPath,
      file_name: doc.file_name,
      issue_date: doc.issue_date,
      expiration_date: doc.expiration_date,
    })
    if (error) throw new Error(`Couldn't attach ${doc.file_name}: ${error.message}`)
  }
}

/** Deletes an application's copied files (used when a draft is deleted). */
export async function removeAttachedFiles(vendorId: string, applicationId: string) {
  const db = createAdminClient()
  const folder = `${vendorId}/applications/${applicationId}`
  const { data } = await db.storage.from("vendor-documents").list(folder, { limit: 100 })
  if (data?.length) {
    await db.storage.from("vendor-documents").remove(data.map((f) => `${folder}/${f.name}`))
  }
}

export type DeliveryResult =
  | { via: "platform" }
  | { via: "email"; emailed: boolean; warning?: string }
  | { via: "not_sent"; warning: string }

/**
 * Sends an application to the market:
 * - Market on Stallpass → it appears in the organizer's dashboard.
 * - Market not on Stallpass → a professional email to the market's contact
 *   with a secure, expiring link to the vendor's profile and documents.
 * Caller must have checked the signed-in vendor owns this application.
 */
export async function deliverApplication(applicationId: string): Promise<DeliveryResult> {
  const db = createAdminClient()
  const { data: app } = await db.from("applications").select("*").eq("id", applicationId).single()
  if (!app) throw new Error("Application not found")
  const application = app as Application

  const [{ data: market }, { data: vendor }, { data: contact }] = await Promise.all([
    db.from("markets").select("*").eq("id", application.market_id).single(),
    db.from("vendors").select("*, profiles!vendors_owner_id_fkey(email, full_name)").eq("id", application.vendor_id).single(),
    db.from("market_contacts").select("contact_email, contact_name").eq("market_id", application.market_id).maybeSingle(),
  ])
  if (!market || !vendor) throw new Error("Market or vendor not found")

  const now = new Date().toISOString()
  const markSent = (fields: Partial<Application>) =>
    db
      .from("applications")
      .update({ status: "submitted", status_source: "vendor", submitted_at: now, ...fields })
      .eq("id", applicationId)

  if ((market as Market).is_claimed) {
    await markSent({ delivered_via: "platform" })
    // Let the organizer know (best effort; it's in their dashboard either way).
    const { data: organizer } = await db
      .from("profiles")
      .select("email")
      .eq("id", (market as Market).organizer_id!)
      .maybeSingle()
    if (organizer?.email) {
      await sendEmail({
        to: organizer.email,
        ...newApplicationEmail({
          marketName: (market as Market).name,
          businessName: (vendor as unknown as Vendor).business_name,
          dates: application.event_dates,
          url: siteUrl(`/organizer/markets/${application.market_id}/applications/${application.id}`),
        }),
      })
    }
    return { via: "platform" }
  }

  if (!contact?.contact_email) {
    await markSent({ delivered_via: "not_sent" })
    return {
      via: "not_sent",
      warning:
        "We don't have an email address for this market yet, so it wasn't sent. Apply through the market's website or Instagram for now. We've saved it in your applications.",
    }
  }

  const token = randomBytes(24).toString("base64url")
  const expires = new Date(Date.now() + SHARE_LINK_DAYS * 86_400_000).toISOString()
  await markSent({ delivered_via: "email", share_token: token, share_expires_at: expires })

  const { data: docs } = await db
    .from("application_documents")
    .select("doc_type, title, expiration_date")
    .eq("application_id", applicationId)

  const owner = (vendor as unknown as { profiles: { email: string; full_name: string | null } }).profiles
  const { data: vc } = await db.from("market_vendor_counts").select("vendor_count").eq("market_id", application.market_id).maybeSingle()
  const email = buildApplicationEmail({
    market: market as Market,
    contactName: contact.contact_name,
    vendor: vendor as unknown as Vendor,
    vendorEmail: owner.email,
    vendorContactName: owner.full_name,
    application,
    documents: docs ?? [],
    shareUrl: siteUrl(`/a/${token}`),
    claimUrl: siteUrl(`/claim/${(market as Market).slug}`),
    linkDays: SHARE_LINK_DAYS,
    vendorCount: vc?.vendor_count ?? 0,
  })
  const sent = await sendEmail({ to: contact.contact_email, replyTo: owner.email, ...email })
  if (sent.ok) {
    await db.from("applications").update({ emailed_at: new Date().toISOString() }).eq("id", applicationId)
    return { via: "email", emailed: true }
  }
  return {
    via: "email",
    emailed: false,
    warning: sent.skipped
      ? "Email isn't set up yet, so the email was printed in the terminal instead of sent."
      : "We saved your application but the email didn't go through. Try “Send again” in a few minutes.",
  }
}
