import { NextResponse, type NextRequest } from "next/server"
import type Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/server"
import { getStripe, markCheckoutPaid, syncPayoutAccount } from "@/lib/stripe"

/**
 * Stripe tells us about payments here (set up as a "Connect" webhook so we
 * hear about payments on organizers' accounts). Every message is checked with
 * STRIPE_WEBHOOK_SECRET so nobody can fake one.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret)
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 })
  }

  const db = createAdminClient()
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session
        if (event.account) await markCheckoutPaid(session.id, event.account)
        break
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session
        await db.from("payments").update({ status: "failed" }).eq("stripe_checkout_session_id", session.id).eq("status", "pending")
        break
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
        if (pi && charge.refunded) {
          const { data } = await db
            .from("payments")
            .update({ status: "refunded" })
            .eq("stripe_payment_intent_id", pi)
            .select("application_id")
            .maybeSingle()
          if (data) await db.from("applications").update({ status: "accepted" }).eq("id", data.application_id).eq("status", "paid")
        }
        break
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        await syncPayoutAccount(account.id)
        break
      }
    }
  } catch (e) {
    console.error(`Webhook ${event.type} failed:`, e)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
