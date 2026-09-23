import "server-only"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"
import { vendorSetupProgress } from "@/lib/setup-progress"
import { createAdminClient } from "@/lib/supabase/server"
import type { Vendor } from "@/lib/types"

/**
 * One friendly "finish setting up" email, a day after someone signs up (e.g.
 * at a market booth) but doesn't finish. Never sent twice. Runs with the
 * daily reminder job.
 */
export async function runSetupNudges(): Promise<{ sent: number; skipped: number }> {
  const db = createAdminClient()
  const now = Date.now()
  const { data: people } = await db
    .from("profiles")
    .select("id, email, full_name, is_shopper, is_organizer, suspended_at, vendors(*)")
    .is("setup_nudged_at", null)
    .is("suspended_at", null)
    .lte("created_at", new Date(now - 20 * 3_600_000).toISOString())
    .gte("created_at", new Date(now - 7 * 86_400_000).toISOString())
    .limit(500)

  let sent = 0
  let skipped = 0
  for (const p of (people ?? []) as unknown as {
    id: string
    email: string
    full_name: string | null
    is_shopper: boolean
    is_organizer: boolean
    vendors: Vendor | null
  }[]) {
    if (!p.email || p.email.endsWith("@example.com")) continue
    const vendor = p.vendors
    let needsNudge = false
    let next = "/onboarding"
    if (vendor) {
      const { data: docs } = await db.from("vendor_documents").select("doc_type").eq("vendor_id", vendor.id)
      const progress = vendorSetupProgress(vendor, docs ?? [])
      needsNudge = !progress.complete
      next = `/onboarding?step=${progress.nextStep}`
    } else {
      // Signed up but never started a business (and isn't a shopper/organizer).
      needsNudge = !p.is_shopper && !p.is_organizer
    }
    if (!needsNudge) continue

    // Mark first so a crash or a second run can never send it twice.
    await db.from("profiles").update({ setup_nudged_at: new Date().toISOString() }).eq("id", p.id)
    const first = p.full_name?.split(" ")[0]
    const url = siteUrl(`/login?next=${encodeURIComponent(next)}`)
    const result = await sendEmail({
      to: p.email,
      subject: "Finish setting up Stallpass (2 minutes)",
      html: emailLayout(
        `<p>Hi${first ? ` ${escapeHtml(first)}` : ""},</p>
<p>You're nearly set up on Stallpass. Add your business and snap your permits and insurance once, and you'll be able to apply to markets in a couple of taps. We'll remind you before anything expires.</p>`,
        { label: "Finish setting up", url }
      ),
      text: `Hi${first ? ` ${first}` : ""},\n\nYou're nearly set up on Stallpass. Finish here (about 2 minutes): ${url}\n`,
    })
    if (result.ok) sent++
    else skipped++
  }
  return { sent, skipped }
}
