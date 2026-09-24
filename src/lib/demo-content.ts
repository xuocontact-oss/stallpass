import "server-only"
import { randomBytes } from "node:crypto"
import { addDays, todayISO } from "@/lib/dates"
import { DEMO_RESOURCES, datesFor, MARKETS, REVIEWS, SHOPPER_REVIEWS, SHOPPERS, VENDORS } from "@/lib/demo-data"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Example content for the LIVE site, so vendors see what Stallpass looks like
 * before real markets join: fictional markets with ratings, vendor reviews and
 * shopper reviews. All of it is marked SAMPLE (shown as "Example"), can't be
 * applied to or reviewed by real people, and is removed with one button.
 *
 * Example reviewers are accounts on @example.com addresses with random
 * passwords nobody knows; they can't be signed into.
 */

const REVIEWER_DOMAIN = "@example.com"

async function must<R extends { data: unknown; error: { message: string } | null }>(
  p: PromiseLike<R>,
  what: string
): Promise<NonNullable<R["data"]>> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as NonNullable<R["data"]>
}

export async function demoContentStatus() {
  const db = createAdminClient()
  const [{ count: markets }, { count: reviews }, { count: shopperReviews }] = await Promise.all([
    db.from("markets").select("id", { count: "exact", head: true }).eq("is_sample", true),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("is_sample", true),
    db.from("shopper_reviews").select("id", { count: "exact", head: true }).eq("is_sample", true),
  ])
  return { markets: markets ?? 0, reviews: reviews ?? 0, shopperReviews: shopperReviews ?? 0 }
}

export async function addDemoContent(): Promise<string> {
  const db = createAdminClient()
  if ((await demoContentStatus()).markets > 0) return "Example content is already on the site."
  const today = todayISO()
  const password = () => randomBytes(24).toString("base64url")

  // Example reviewer vendors (no documents, no logins anyone knows).
  const vendorIds = new Map<string, string>()
  for (const v of VENDORS) {
    const { user } = await must(db.auth.admin.createUser({ email: v.email, password: password(), email_confirm: true }), `reviewer ${v.email}`)
    await db.from("profiles").update({ full_name: v.name }).eq("id", user!.id)
    const vendor = await must(db.from("vendors").insert({ ...v.vendor, owner_id: user!.id, is_sample: true }).select("id").single(), "vendor")
    vendorIds.set(v.email, vendor.id)
  }

  // Example markets and their dates.
  const marketIds = new Map<string, string>()
  const marketDates = new Map<string, string[]>()
  for (const m of MARKETS) {
    const market = await must(
      db
        .from("markets")
        .insert({
          slug: m.slug,
          name: m.name,
          market_type: m.market_type,
          organizer_name: m.organizer_name,
          address: m.address,
          city: m.city,
          state: "CA",
          zip: m.zip,
          lat: m.lat,
          lng: m.lng,
          schedule_summary: m.schedule_summary,
          description: `${m.description}\n\n(Example market to show how Stallpass works. Not a real event.)`,
          booth_fees: m.fees.map(([label, dollars]) => ({ label, amount_cents: dollars * 100 })),
          required_doc_types: m.required,
          categories_wanted: m.categories,
          application_deadline: m.deadlineInDays ? addDays(today, m.deadlineInDays) : null,
          is_sample: true,
          approval_status: "approved",
        })
        .select("id")
        .single(),
      `market ${m.name}`
    )
    marketIds.set(m.slug, market.id)
    const dates = datesFor(m, today)
    marketDates.set(m.slug, dates)
    if (dates.length) {
      await must(
        db.from("market_dates").insert(dates.map((d) => ({ market_id: market.id, event_date: d, starts_at: m.starts_at, ends_at: m.ends_at }))),
        "dates"
      )
    }
  }

  // Vendor reviews (each backed by an accepted, verified example application).
  const past = (slug: string, n: number) => (marketDates.get(slug) ?? []).filter((d) => d < today).reverse()[n]
  let reviewCount = 0
  for (const [email, slug, idx, [ft, org, val, overall], sales, body, extra] of REVIEWS) {
    const day = past(slug, idx)
    const vendorId = vendorIds.get(email)
    const marketId = marketIds.get(slug)
    if (!day || !vendorId || !marketId || extra?.hidden) continue
    const app = await must(
      db
        .from("applications")
        .insert({
          vendor_id: vendorId,
          market_id: marketId,
          status: "accepted",
          status_source: "admin",
          event_dates: [day],
          delivered_via: "email",
          verified_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      "application"
    )
    await must(
      db.from("reviews").insert({
        vendor_id: vendorId,
        market_id: marketId,
        application_id: app.id,
        event_date: day,
        rating_foot_traffic: ft,
        rating_organization: org,
        rating_value: val,
        rating_overall: overall,
        sales_range: sales,
        body,
        is_sample: true,
        organizer_reply: extra?.reply ?? null,
        organizer_reply_at: extra?.reply ? new Date().toISOString() : null,
      }),
      "review"
    )
    reviewCount++
  }

  // Shopper reviews.
  const shopperIds: string[] = []
  for (const sh of SHOPPERS) {
    const { user } = await must(db.auth.admin.createUser({ email: sh.email, password: password(), email_confirm: true }), `shopper ${sh.email}`)
    await db.from("profiles").update({ full_name: sh.name, is_shopper: true }).eq("id", user!.id)
    shopperIds.push(user!.id)
  }
  for (const [who, slug, daysAgo, [overall, variety, atmosphere, prices], body] of SHOPPER_REVIEWS) {
    const marketId = marketIds.get(slug)
    if (!marketId) continue
    await must(
      db.from("shopper_reviews").insert({
        market_id: marketId,
        user_id: shopperIds[who],
        visited_on: addDays(today, -daysAgo),
        rating_overall: overall,
        rating_variety: variety,
        rating_atmosphere: atmosphere,
        rating_prices: prices,
        body,
        is_sample: true,
      }),
      "shopper review"
    )
  }

  // Example Start-hub listings.
  await must(db.from("resources").insert(DEMO_RESOURCES.map((r) => ({ ...r, is_sample: true })), { defaultToNull: false }), "resources")

  // Sample accounts count as verified, with a password.
  await db.from("profiles").update({ email_verified_at: new Date().toISOString(), has_password: true }).like("email", "demo-%@example.com")

  return `Added ${MARKETS.length} example markets, ${reviewCount} vendor reviews and ${SHOPPER_REVIEWS.length} shopper reviews.`
}

/** Removes every example market, review, reviewer account and listing. Real people are untouched. */
export async function removeDemoContent(): Promise<string> {
  const db = createAdminClient()
  const exampleEmails = new Set([...VENDORS.map((v) => v.email), ...SHOPPERS.map((s) => s.email)])
  let accounts = 0
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users ?? []
    for (const u of users) {
      if (!u.email || !u.email.endsWith(REVIEWER_DOMAIN) || !exampleEmails.has(u.email)) continue
      // Only accounts whose business is marked as an example.
      const { data: v } = await db.from("vendors").select("is_sample").eq("owner_id", u.id).maybeSingle()
      const { data: p } = await db.from("profiles").select("is_shopper").eq("id", u.id).maybeSingle()
      if (v && !v.is_sample) continue
      if (!v && !p?.is_shopper) continue
      await db.auth.admin.deleteUser(u.id)
      accounts++
    }
    if (users.length < 1000) break
  }
  const { count: markets } = await db.from("markets").delete({ count: "exact" }).eq("is_sample", true)
  await db.from("resources").delete().eq("is_sample", true)
  return `Removed ${markets ?? 0} example markets, their reviews, and ${accounts} example reviewer accounts. Real vendors weren't touched.`
}
