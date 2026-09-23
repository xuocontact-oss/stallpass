import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

/** "Download my data": everything we hold about you, as a JSON file. */
export async function GET() {
  const user = await getUser()
  if (!user) return new NextResponse("Please sign in.", { status: 401 })
  const supabase = await createClient()
  const own = <T,>(p: PromiseLike<{ data: T | null }>) => p.then((r) => r.data)

  const profile = await own(supabase.from("profiles").select("*").eq("id", user.id).maybeSingle())
  const vendor = await own(supabase.from("vendors").select("*").eq("owner_id", user.id).maybeSingle())
  const vendorId = (vendor as { id?: string } | null)?.id
  const [documents, photos, applications, reviews, shopperReviews, payments, claims, markets] = await Promise.all([
    vendorId ? own(supabase.from("vendor_documents").select("*").eq("vendor_id", vendorId)) : [],
    vendorId ? own(supabase.from("vendor_photos").select("*").eq("vendor_id", vendorId)) : [],
    vendorId ? own(supabase.from("applications").select("*").eq("vendor_id", vendorId)) : [],
    vendorId ? own(supabase.from("reviews").select("*").eq("vendor_id", vendorId)) : [],
    own(supabase.from("shopper_reviews").select("*").eq("user_id", user.id)),
    vendorId ? own(supabase.from("payments").select("*").eq("vendor_id", vendorId)) : [],
    own(supabase.from("market_claims").select("*").eq("user_id", user.id)),
    own(supabase.from("markets").select("*").eq("organizer_id", user.id)),
  ])

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      note: "Document and photo files aren't included; download them from the app.",
      account: { email: user.email, ...(profile ?? {}) },
      vendor_business: vendor,
      documents,
      photos,
      applications,
      reviews_written_as_vendor: reviews,
      reviews_written_as_shopper: shopperReviews,
      payments,
      market_claims: claims,
      markets_you_run: markets,
    },
    null,
    2
  )
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stallpass-my-data.json"`,
      "Cache-Control": "no-store",
    },
  })
}
