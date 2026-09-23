import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { logResourceEvent } from "@/lib/partners"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Every Start-hub link goes through here so we can count clicks for partners,
 * then on to the partner's tracking link (or the normal website).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params
  const home = new URL("/start", request.nextUrl.origin)
  if (!z.uuid().safeParse(id).success) return NextResponse.redirect(home)

  const db = createAdminClient()
  const [{ data: resource }, { data: partner }] = await Promise.all([
    db.from("resources").select("url, is_published").eq("id", id).maybeSingle(),
    db.from("resource_partner_details").select("referral_url").eq("resource_id", id).maybeSingle(),
  ])
  const destination = resource?.is_published ? (partner?.referral_url ?? resource.url) : null
  if (!destination || !/^https?:\/\//i.test(destination)) return NextResponse.redirect(home)

  await logResourceEvent(id, "click", request.nextUrl.searchParams.get("from"))
  return NextResponse.redirect(destination)
}
