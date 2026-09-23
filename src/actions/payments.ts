"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getMyVendor, getOrganizedMarket, getProfile, getUser, isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { boothFeeTotal, platformFee } from "@/lib/fees"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { getStripe } from "@/lib/stripe"
import { siteUrl } from "@/lib/email"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { Application, Market } from "@/lib/types"

// ---------------------------------------------------------------------------
// Organizer: connect Stripe
// ---------------------------------------------------------------------------

/** Creates (once) the organizer's Stripe Express account and opens Stripe's sign-up. */
export async function startStripeOnboarding(): Promise<ActionState> {
  const stripe = getStripe()
  if (!stripe) return { error: "Card payments aren't set up on Stallpass yet (no Stripe key)." }
  const profile = await getProfile()
  if (!profile?.is_organizer) return { error: "Only organizers can connect Stripe." }

  const db = createAdminClient()
  const { data: existing } = await db.from("payout_accounts").select("stripe_account_id").eq("user_id", profile.id).maybeSingle()
  let accountId = existing?.stripe_account_id
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: profile.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { stallpass_user_id: profile.id },
    })
    accountId = account.id
    const { error } = await db.from("payout_accounts").insert({ user_id: profile.id, stripe_account_id: accountId })
    if (error) return { error: friendlyDbError(error) }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: siteUrl("/organizer/payments?refresh=1"),
    return_url: siteUrl("/organizer/payments?returned=1"),
  })
  redirect(link.url)
}

/** Opens the organizer's Stripe Express dashboard (payouts, refunds). */
export async function openStripeDashboard(): Promise<ActionState> {
  const stripe = getStripe()
  const user = await getUser()
  if (!stripe || !user) return { error: "Stripe isn't available." }
  const db = createAdminClient()
  const { data } = await db.from("payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle()
  if (!data) return { error: "Connect Stripe first." }
  const link = await stripe.accounts.createLoginLink(data.stripe_account_id)
  redirect(link.url)
}

// ---------------------------------------------------------------------------
// How a market takes payment (organizer, or the admin)
// ---------------------------------------------------------------------------

export async function savePaymentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const marketId = formText(formData, "market_id") ?? ""
  if (!z.uuid().safeParse(marketId).success) return { error: "Market not found." }
  const admin = await isAdmin()
  const market = admin ? null : await getOrganizedMarket(marketId)
  if (!admin && !market) return { error: "You don't run this market." }

  const method = formText(formData, "payment_method") ?? "none"
  const link = formText(formData, "payment_link")
  const instructions = formText(formData, "payment_instructions")
  if (!["none", "stripe", "external_link"].includes(method)) return { error: "Choose how vendors pay." }
  if (method === "external_link") {
    if (!link || !/^https:\/\/\S+$/i.test(link)) return { error: "Paste the full payment link, starting with https://" }
  }
  if (instructions && instructions.length > 1000) return { error: "Keep instructions under 1,000 characters." }

  const supabase = await createClient()
  if (method === "stripe") {
    const { data: m } = await supabase.from("markets").select("organizer_id").eq("id", marketId).single()
    const { data: acct } = m?.organizer_id
      ? await createAdminClient().from("payout_accounts").select("charges_enabled").eq("user_id", m.organizer_id).maybeSingle()
      : { data: null }
    if (!acct?.charges_enabled) return { error: "Connect Stripe first (Organizer → Payments), then choose this." }
  }

  const { error } = await supabase
    .from("markets")
    .update({ payment_method: method, payment_link: method === "external_link" ? link : null, payment_instructions: instructions })
    .eq("id", marketId)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/organizer/markets/${marketId}`, "layout")
  revalidatePath(`/admin/markets/${marketId}`)
  return { success: "Payment settings saved." }
}

// ---------------------------------------------------------------------------
// Vendor: pay
// ---------------------------------------------------------------------------

async function loadOwnAcceptedApplication(appId: string) {
  if (!z.uuid().safeParse(appId).success) return null
  const vendor = await getMyVendor()
  if (!vendor) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("*, markets(*)")
    .eq("id", appId)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  return data as (Application & { markets: Market }) | null
}

/** Starts Stripe Checkout for an accepted application's booth fee. */
export async function startBoothPayment(appId: string): Promise<ActionState> {
  const stripe = getStripe()
  if (!stripe) return { error: "Card payments aren't set up yet." }
  const app = await loadOwnAcceptedApplication(appId)
  if (!app) return { error: "Application not found." }
  if (app.status !== "accepted") return { error: app.status === "paid" ? "Already paid!" : "You can pay once you're accepted." }
  const market = app.markets
  if (market.payment_method !== "stripe" || !market.organizer_id) return { error: "This market doesn't take card payments here." }

  const fee = boothFeeTotal(market.booth_fees, app.booth_choice, app.event_dates.length)
  if (!fee || fee.total < 50) return { error: "This market hasn't set a booth fee. Contact the organizer." }

  const db = createAdminClient()
  const [{ data: acct }, { data: settings }] = await Promise.all([
    db.from("payout_accounts").select("stripe_account_id, charges_enabled").eq("user_id", market.organizer_id).maybeSingle(),
    db.from("platform_settings").select("platform_fee_percent, platform_fee_flat_cents").eq("id", 1).single(),
  ])
  if (!acct?.charges_enabled) return { error: "The organizer hasn't finished setting up card payments yet." }
  const feeCents = platformFee(fee.total, Number(settings?.platform_fee_percent ?? 0), settings?.platform_fee_flat_cents ?? 0)
  const user = await getUser()

  const description = `${fee.label} at ${market.name}: ${app.event_dates.map((d) => formatDate(d)).join(", ")}`.slice(0, 300)
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: user?.email,
      line_items: [
        {
          quantity: app.event_dates.length,
          price_data: {
            currency: "usd",
            unit_amount: fee.perDate,
            product_data: { name: `Booth fee: ${market.name}`, description },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        receipt_email: user?.email,
        metadata: { application_id: app.id },
      },
      metadata: { application_id: app.id },
      success_url: siteUrl(`/applications/${app.id}/paid?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: siteUrl(`/applications/${app.id}?payment=cancelled`),
    },
    { stripeContext: acct.stripe_account_id }
  )

  const { error } = await db.from("payments").insert({
    application_id: app.id,
    market_id: market.id,
    vendor_id: app.vendor_id,
    method: "stripe",
    status: "pending",
    amount_cents: fee.total,
    platform_fee_cents: feeCents,
    description,
    stripe_account_id: acct.stripe_account_id,
    stripe_checkout_session_id: session.id,
  })
  if (error) return { error: friendlyDbError(error) }
  redirect(session.url!)
}

/** Vendor paid on the market's own payment page and taps "I've paid". */
export async function reportExternalPayment(appId: string): Promise<ActionState> {
  const app = await loadOwnAcceptedApplication(appId)
  if (!app) return { error: "Application not found." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("vendor_report_external_payment", { app: appId })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/applications/${appId}`)
  return {
    success: app.markets.organizer_id
      ? "Thanks! The organizer will confirm your payment."
      : "Marked as paid.",
  }
}

// ---------------------------------------------------------------------------
// Organizer: confirm "I've paid"
// ---------------------------------------------------------------------------

export async function confirmExternalPayment(paymentId: string, confirmed: boolean): Promise<ActionState> {
  if (!z.uuid().safeParse(paymentId).success) return { error: "Payment not found." }
  const supabase = await createClient()
  const { data: p } = await supabase.from("payments").select("market_id").eq("id", paymentId).maybeSingle()
  if (!p || !(await getOrganizedMarket(p.market_id))) return { error: "Payment not found." }
  const { error } = await supabase.rpc("organizer_confirm_payment", { payment: paymentId, confirmed })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/organizer/markets/${p.market_id}`, "layout")
  return { success: confirmed ? "Payment confirmed. The vendor is marked paid." : "Marked as not received." }
}
