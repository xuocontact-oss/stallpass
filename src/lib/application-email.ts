import "server-only"
import { categoryLabel, documentTypeLabel, setupTypeLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { emailLayout, escapeHtml } from "@/lib/email"
import type { Application, Market, Vendor } from "@/lib/types"

/** The email a market (not yet on Stallpass) receives when a vendor applies. */
export function buildApplicationEmail(input: {
  market: Market
  contactName: string | null
  vendor: Vendor
  vendorEmail: string
  vendorContactName: string | null
  application: Application
  documents: { doc_type: string; title: string | null; expiration_date: string | null }[]
  shareUrl: string
  claimUrl: string
  linkDays: number
}) {
  const { market, vendor, application, documents } = input
  const e = escapeHtml
  const dates = application.event_dates.map((d) => formatDate(d, { weekday: true }))
  const needs = [vendor.needs_power && "power", vendor.needs_water && "water"].filter(Boolean).join(" and ")
  const setup = `${setupTypeLabel(vendor.setup_type)}${needs ? `, needs ${needs}` : ", no power or water needed"}`
  const docLines = documents.map(
    (d) =>
      `${documentTypeLabel(d.doc_type)}${d.title ? ` (${d.title})` : ""}${
        d.expiration_date ? `, valid until ${formatDate(d.expiration_date)}` : ""
      }`
  )
  const socials = [vendor.instagram, vendor.website, vendor.tiktok, vendor.facebook].filter(Boolean) as string[]

  const subject = `Vendor application: ${vendor.business_name} for ${market.name}`

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#78716c;vertical-align:top;white-space:nowrap">${e(label)}</td><td style="padding:4px 0">${value}</td></tr>`

  const html = emailLayout(
    `<p>Hi${input.contactName ? ` ${e(input.contactName)}` : ""},</p>
<p><strong>${e(vendor.business_name)}</strong> would like a spot at <strong>${e(market.name)}</strong>.</p>
<table style="border-collapse:collapse;font-size:14px;margin:12px 0">
${row("Dates", e(dates.join(", ")))}
${application.booth_choice ? row("Booth", e(application.booth_choice)) : ""}
${row("Food", e(categoryLabel(vendor.category)))}
${row("Setup", e(setup))}
${vendor.setup_notes ? row("Setup notes", e(vendor.setup_notes)) : ""}
${row("Contact", `${e(input.vendorContactName ?? vendor.business_name)}, <a href="mailto:${e(input.vendorEmail)}">${e(input.vendorEmail)}</a>${vendor.phone ? `, ${e(vendor.phone)}` : ""}`)}
${socials.length ? row("Online", e(socials.join(" · "))) : ""}
</table>
${application.note ? `<p style="background:#faf7f4;border-radius:8px;padding:12px;white-space:pre-line"><strong>Note from the vendor:</strong><br>${e(application.note)}</p>` : ""}
${vendor.description ? `<p style="white-space:pre-line">${e(vendor.description)}</p>` : ""}
<p><strong>Documents attached</strong></p>
${docLines.length ? `<ul>${docLines.map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : "<p>None attached.</p>"}
<p>See the full profile, menu, photos and documents here. The secure link works for ${input.linkDays} days:</p>`,
    { label: "View application & documents", url: input.shareUrl }
  ).replace(
    "</div></body>",
    `<div style="background:#fff;border-radius:12px;padding:20px;margin-top:12px;font-size:14px;line-height:1.5">
<p style="margin:0 0 8px"><strong>Run ${e(market.name)}?</strong> Claim your free listing on Stallpass to get every application with documents already checked, in one place, and collect booth fees online.</p>
<a href="${e(input.claimUrl)}" style="color:#e0592a;font-weight:600">Claim ${e(market.name)} →</a>
</div>
<p style="font-size:12px;color:#78716c">Reply to this email to reach ${e(vendor.business_name)} directly.</p></div></body>`
  )

  const text = [
    `${vendor.business_name} would like a spot at ${market.name}.`,
    ``,
    `Dates: ${dates.join(", ")}`,
    application.booth_choice ? `Booth: ${application.booth_choice}` : null,
    `Food: ${categoryLabel(vendor.category)}`,
    `Setup: ${setup}`,
    `Contact: ${input.vendorContactName ?? vendor.business_name}, ${input.vendorEmail}${vendor.phone ? `, ${vendor.phone}` : ""}`,
    application.note ? `\nNote from the vendor:\n${application.note}` : null,
    ``,
    `Documents attached:`,
    ...(docLines.length ? docLines.map((l) => `- ${l}`) : ["- None"]),
    ``,
    `Full profile, menu, photos and documents (link works for ${input.linkDays} days):`,
    input.shareUrl,
    ``,
    `Run ${market.name}? Claim your free listing: ${input.claimUrl}`,
    `Reply to this email to reach ${vendor.business_name} directly.`,
  ]
    .filter((l) => l !== null)
    .join("\n")

  return { subject, html, text }
}
