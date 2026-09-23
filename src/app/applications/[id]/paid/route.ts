import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { markCheckoutPaid } from "@/lib/stripe"

/**
 * Where Stripe sends the vendor after paying. We double-check with Stripe
 * that the payment really went through (never trust the address alone).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/applications/[id]/paid">) {
  const { id } = await ctx.params
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? ""
  const back = new URL(`/applications/${id}`, request.nextUrl.origin)
  if (!z.uuid().safeParse(id).success || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.redirect(back)

  // The security rules only return this payment to its own vendor.
  const supabase = await createClient()
  const { data: payment } = await supabase
    .from("payments")
    .select("stripe_account_id")
    .eq("application_id", id)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle()
  if (payment?.stripe_account_id) {
    try {
      const paid = await markCheckoutPaid(sessionId, payment.stripe_account_id)
      back.searchParams.set("payment", paid ? "success" : "processing")
    } catch (e) {
      console.error("Payment check failed:", e)
      back.searchParams.set("payment", "processing")
    }
  }
  return NextResponse.redirect(back)
}
