import "server-only"
import Stripe from "stripe"
import { formatDate } from "@/lib/dates"
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email"
import { formatMoney } from "@/lib/markets"
import { createAdminClient } from "@/lib/supabase/server"

let client: Stripe | null = null

/** The Stripe client, or null while Stripe isn't set up (no STRIPE_SECRET_KEY). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  client ??= new Stripe(key)
  return client
}

export function stripeIsTestMode() {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")
}

/** Keeps our copy of an organizer's Stripe account status up to date. */
export async function syncPayoutAccount(accountId: string) {
  const stripe = getStripe()
  if (!stripe) return null
  const account = await stripe.accounts.retrieve(accountId)
  const db = createAdminClient()
  await db
    .from("payout_accounts")
    .update({
      charges_enabled: account.charges_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId)
  return account
}

/**
 * Marks a Stripe payment as paid (from the success page OR the webhook,
 * whichever comes first; safe to call twice), marks the application paid,
 * and emails receipts once.
 */
export async function markCheckoutPaid(sessionId: string, accountId: string) {
  const stripe = getStripe()
  if (!stripe) return false
  const session = await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeContext: accountId })
  if (session.payment_status !== "paid") return false

  const db = createAdminClient()
  const { data: payment } = await db
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()
  if (!payment) return true // already handled

  await db.from("applications").update({ status: "paid" }).eq("id", payment.application_id).eq("status", "accepted")
  await sendReceipts(payment.id)
  return true
}

async function sendReceipts(paymentId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from("payments")
    .select(
      "id, amount_cents, application_id, receipt_emailed_at, applications(event_dates, booth_choice, booth_number), markets(name, organizer_id), vendors(business_name, profiles!vendors_owner_id_fkey(email))"
    )
    .eq("id", paymentId)
    .single()
  if (!data || data.receipt_emailed_at) return
  const p = data as unknown as {
    id: string
    amount_cents: number
    application_id: string
    applications: { event_dates: string[]; booth_choice: string | null; booth_number: string | null }
    markets: { name: string; organizer_id: string | null }
    vendors: { business_name: string; profiles: { email: string } }
  }
  const dates = p.applications.event_dates.map((d) => formatDate(d, { weekday: true })).join(", ")
  const amount = formatMoney(p.amount_cents)
  const lines = [
    `Market: ${p.markets.name}`,
    `Dates: ${dates}`,
    p.applications.booth_choice ? `Booth: ${p.applications.booth_choice}${p.applications.booth_number ? ` (#${p.applications.booth_number})` : ""}` : null,
    `Amount paid: ${amount}`,
    `Receipt number: ${p.id.slice(0, 8).toUpperCase()}`,
  ].filter(Boolean) as string[]

  await sendEmail({
    to: p.vendors.profiles.email,
    subject: `Receipt: ${amount} booth fee for ${p.markets.name}`,
    html: emailLayout(
      `<p>Thanks, ${escapeHtml(p.vendors.business_name)}! Your booth fee is paid.</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul><p style="color:#78716c;font-size:13px">Stripe also emails a card receipt. Questions about refunds go to the market.</p>`,
      { label: "See your application", url: siteUrl(`/applications/${p.application_id}`) }
    ),
    text: `Thanks, ${p.vendors.business_name}! Your booth fee is paid.\n\n${lines.join("\n")}\n`,
  })

  if (p.markets.organizer_id) {
    const { data: org } = await db.from("profiles").select("email").eq("id", p.markets.organizer_id).single()
    if (org?.email) {
      await sendEmail({
        to: org.email,
        subject: `${p.vendors.business_name} paid ${amount} for ${p.markets.name}`,
        html: emailLayout(`<p>${escapeHtml(p.vendors.business_name)} paid their booth fee.</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul><p>Stripe pays it out to your bank automatically.</p>`),
        text: `${p.vendors.business_name} paid their booth fee.\n\n${lines.join("\n")}\n\nStripe pays it out to your bank automatically.\n`,
      })
    }
  }
  await db.from("payments").update({ receipt_emailed_at: new Date().toISOString() }).eq("id", p.id)
}
