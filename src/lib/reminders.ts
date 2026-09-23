import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { documentTypeLabel } from "@/lib/constants"
import { addDays, daysBetween, formatDate, relativeDays, todayISO } from "@/lib/dates"
import { reminderKindFor } from "@/lib/documents"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"

/**
 * Most emails the daily job sends in one run. Gmail allows about 500 a day,
 * and sign-in codes use the same account, so this leaves plenty of room.
 * Anything over the limit goes out on the next day's run.
 */
export const MAX_EMAILS_PER_RUN = Number(process.env.MAX_DAILY_JOB_EMAILS || 200)

export type ReminderRunResult = {
  documentsChecked: number
  emailsSent: number
  emailsSkipped: number
  emailsFailed: number
  log: string[]
}

type DueDoc = {
  id: string
  doc_type: string
  title: string | null
  expiration_date: string
  vendors: {
    business_name: string
    is_sample: boolean
    profiles: { email: string; suspended_at: string | null } | null
  } | null
}

/**
 * Emails vendors about documents expiring in the next 30 days: one reminder
 * around 30 days out, another in the final 7 days. Runs once a day (Vercel
 * Cron) and can be run by hand from the admin page. Safe to run repeatedly:
 * each reminder is recorded, so it's never sent twice.
 */
export async function runDocumentReminders(): Promise<ReminderRunResult> {
  const db = createAdminClient()
  const today = todayISO()
  const result: ReminderRunResult = {
    documentsChecked: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    log: [],
  }

  const { data, error } = await db
    .from("vendor_documents")
    .select(
      "id, doc_type, title, expiration_date, vendors!inner(business_name, is_sample, profiles!vendors_owner_id_fkey(email, suspended_at))"
    )
    .gte("expiration_date", today)
    .lte("expiration_date", addDays(today, 30))
  if (error) throw new Error(`Couldn't load documents: ${error.message}`)

  const docs = (data ?? []) as unknown as DueDoc[]
  result.documentsChecked = docs.length

  // Group what's due by vendor email, so each vendor gets one email per run.
  const byEmail = new Map<string, { business: string; items: { doc: DueDoc; kind: string; days: number }[] }>()
  for (const doc of docs) {
    const vendor = doc.vendors
    const email = vendor?.profiles?.email
    if (!vendor || !email || vendor.is_sample || vendor.profiles?.suspended_at) continue
    const days = daysBetween(today, doc.expiration_date)
    const kind = reminderKindFor(days)
    if (!kind) continue
    const group = byEmail.get(email) ?? { business: vendor.business_name, items: [] }
    group.items.push({ doc, kind, days })
    byEmail.set(email, group)
  }

  for (const [email, group] of byEmail) {
    if (result.emailsSent >= MAX_EMAILS_PER_RUN) {
      result.log.push(`Stopped at ${MAX_EMAILS_PER_RUN} emails; the rest go out tomorrow.`)
      break
    }
    // Claim the reminders first. Ones already sent come back empty, which also
    // stops two runs at the same moment from double-sending.
    const { data: claimed, error: claimError } = await db
      .from("document_reminders")
      .upsert(
        group.items.map((i) => ({
          document_id: i.doc.id,
          kind: i.kind,
          expiration_date: i.doc.expiration_date,
        })),
        { onConflict: "document_id,kind,expiration_date", ignoreDuplicates: true }
      )
      .select("document_id, kind, expiration_date")
    if (claimError) throw new Error(`Couldn't record reminders: ${claimError.message}`)
    if (!claimed?.length) continue

    const claimedIds = new Set(claimed.map((c) => c.document_id))
    const items = group.items.filter((i) => claimedIds.has(i.doc.id))
    const sent = await sendEmail(reminderEmail(email, group.business, items))

    if (sent.ok) {
      result.emailsSent++
      result.log.push(`Sent to ${email}: ${items.length} document(s)`)
    } else {
      // Un-claim so it's tried again next run.
      for (const c of claimed) {
        await db
          .from("document_reminders")
          .delete()
          .match({ document_id: c.document_id, kind: c.kind, expiration_date: c.expiration_date })
      }
      if (sent.skipped) {
        result.emailsSkipped++
        result.log.push(`Not sent to ${email} (email not set up; printed in terminal)`)
      } else {
        result.emailsFailed++
        result.log.push(`FAILED for ${email}: ${sent.error}`)
      }
    }
  }

  return result
}

function reminderEmail(
  to: string,
  business: string,
  items: { doc: DueDoc; days: number }[]
) {
  const name = (i: { doc: DueDoc }) =>
    i.doc.title ? `${documentTypeLabel(i.doc.doc_type)}: ${i.doc.title}` : documentTypeLabel(i.doc.doc_type)
  const soonest = Math.min(...items.map((i) => i.days))
  const subject =
    items.length === 1
      ? `Your ${name(items[0]).toLowerCase()} expires ${relativeDays(soonest)}`
      : `${items.length} documents expire soon`
  const lines = items.map(
    (i) => `${name(i)} expires ${formatDate(i.doc.expiration_date)} (${relativeDays(i.days)})`
  )
  const url = siteUrl("/documents")

  const html = emailLayout(
    `<p>Hi ${escapeHtml(business)},</p>
<p>Heads up: ${items.length === 1 ? "this document is" : "these documents are"} about to expire. Markets usually won't accept expired paperwork, so renew now and upload the new copy.</p>
<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
    { label: "Update my documents", url }
  )
  const text = `Hi ${business},\n\nThese documents are about to expire:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nUpdate them here: ${url}\n`
  return { to, subject, html, text }
}
