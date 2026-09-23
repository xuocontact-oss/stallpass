import "server-only"
import { formatDate } from "@/lib/dates"
import { emailLayout, escapeHtml as e, siteUrl } from "@/lib/email"

const dateList = (dates: string[]) => dates.map((d) => formatDate(d, { weekday: true })).join(", ")

/** To the vendor, when the organizer accepts / waitlists / declines. */
export function decisionEmail(input: {
  status: "accepted" | "waitlisted" | "declined"
  marketName: string
  businessName: string
  dates: string[]
  booth: string | null
  note: string | null
  applicationId: string
}) {
  const headline = {
    accepted: `You're in! ${input.marketName} accepted your application`,
    waitlisted: `You're on the waitlist for ${input.marketName}`,
    declined: `${input.marketName} couldn't fit you in this time`,
  }[input.status]
  const url = siteUrl(`/applications/${input.applicationId}`)
  const html = emailLayout(
    `<p>Hi ${e(input.businessName)},</p>
<p><strong>${e(headline)}</strong> for ${e(dateList(input.dates))}.</p>
${input.booth ? `<p>Your booth: <strong>${e(input.booth)}</strong></p>` : ""}
${input.note ? `<p style="background:#faf7f4;border-radius:8px;padding:12px;white-space:pre-line"><strong>Message from the organizer:</strong><br>${e(input.note)}</p>` : ""}
${input.status === "declined" ? "<p>Don't be discouraged: markets fill up fast. There are plenty more to try on Stallpass.</p>" : ""}`,
    { label: "See your application", url }
  )
  const text = `Hi ${input.businessName},\n\n${headline} for ${dateList(input.dates)}.\n${input.booth ? `Your booth: ${input.booth}\n` : ""}${input.note ? `\nMessage from the organizer:\n${input.note}\n` : ""}\nSee your application: ${url}\n`
  return { subject: headline, html, text }
}

/** To the organizer, when a vendor applies to their market on Stallpass. */
export function newApplicationEmail(input: {
  marketName: string
  businessName: string
  dates: string[]
  url: string
}) {
  const subject = `New application: ${input.businessName} for ${input.marketName}`
  const html = emailLayout(
    `<p><strong>${e(input.businessName)}</strong> applied to <strong>${e(input.marketName)}</strong> for ${e(dateList(input.dates))}.</p>
<p>Their documents are already checked against your requirements.</p>`,
    { label: "Review application", url: input.url }
  )
  const text = `${input.businessName} applied to ${input.marketName} for ${dateList(input.dates)}.\n\nReview it: ${input.url}\n`
  return { subject, html, text }
}

/** An organizer's message to all accepted vendors of a date. */
export function broadcastEmail(input: { marketName: string; eventDate: string | null; subject: string; body: string }) {
  const subject = `${input.marketName}: ${input.subject}`
  const html = emailLayout(
    `<p style="color:#78716c;margin-top:0">Message from ${e(input.marketName)}${input.eventDate ? ` about ${e(formatDate(input.eventDate, { weekday: true }))}` : ""}</p>
<p style="white-space:pre-line">${e(input.body)}</p>
<p style="color:#78716c;font-size:13px">Reply to this email to reach the organizer.</p>`
  )
  const text = `Message from ${input.marketName}${input.eventDate ? ` about ${formatDate(input.eventDate)}` : ""}:\n\n${input.body}\n\nReply to this email to reach the organizer.\n`
  return { subject, html, text }
}
