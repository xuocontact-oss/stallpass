/**
 * Sample data for local testing.  Run:  npm run seed
 *
 * Creates sample vendor accounts (password below) with documents, and sample
 * markets around Los Angeles. Everything is marked as SAMPLE in the app.
 * Safe to run again: it removes the previous sample data first and never
 * touches anything else.
 *
 * DEVELOPMENT ONLY. Do not run this against your live database.
 */
import { createClient } from "@supabase/supabase-js"
import { addDays, todayISO } from "../src/lib/dates.ts"
import { repeatingDates } from "../src/lib/markets.ts"
import { CLAIMED_SLUG, datesFor as demoDatesFor, MARKETS, REVIEWS, SHOPPER_REVIEWS, SHOPPERS, VENDORS, DEMO_RESOURCES } from "../src/lib/demo-data.ts"

const datesFor = (m: (typeof MARKETS)[number]) => demoDatesFor(m, todayISO())

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
  process.exit(1)
}
// Safety lock: sample data only ever goes into a TEST project.
const site = process.env.NEXT_PUBLIC_SITE_URL ?? ""
if (!site.startsWith("http://localhost") && process.env.ALLOW_SAMPLE_DATA !== "yes") {
  console.error(
    `Refusing to add sample data: NEXT_PUBLIC_SITE_URL is "${site}", which looks like a live site.\n` +
      "Sample data is only for your test project. (If this really is a test project, run with ALLOW_SAMPLE_DATA=yes.)"
  )
  process.exit(1)
}

const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const PASSWORD = "stallpass-demo-2026"
const today = todayISO()

/** Waits for a Supabase call and stops the script with a clear message if it failed. */
async function must<R extends { data: unknown; error: { message: string } | null }>(
  p: PromiseLike<R>,
  what: string
): Promise<NonNullable<R["data"]>> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as NonNullable<R["data"]>
}

// A tiny one-page PDF that clearly says it's a sample.
function samplePdf(title: string): Uint8Array {
  const text = `SAMPLE DOCUMENT - ${title} - not a real permit`.replace(/[()\\]/g, "")
  const stream = `BT /F1 14 Tf 50 740 Td (${text}) Tj ET`
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(out)
}

// ---------------------------------------------------------------------------
// Sample vendors
// ---------------------------------------------------------------------------

const ORGANIZER = { email: "demo-organizer@example.com", name: "Jordan (sample organizer)" }
// A newer organizer whose claim and new market are waiting for admin approval.
const ORGANIZER2 = { email: "demo-organizer2@example.com", name: "Riley (sample organizer)" }
// The one sample market that is "on Stallpass" (claimed by the sample organizer).

// ---------------------------------------------------------------------------
// Sample markets (fictional; locations are real neighborhoods)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/** Every file under a storage folder, including sub-folders. */
async function listAll(bucket: string, folder: string): Promise<string[]> {
  const { data } = await db.storage.from(bucket).list(folder, { limit: 1000 })
  const out: string[] = []
  for (const f of data ?? []) {
    const path = `${folder}/${f.name}`
    if (f.id) out.push(path)
    else out.push(...(await listAll(bucket, path))) // a folder
  }
  return out
}

async function removeOldSampleData() {
  const emails = new Set([...VENDORS.map((v) => v.email), ORGANIZER.email, ORGANIZER2.email, ...SHOPPERS.map((x) => x.email)])
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users?.users ?? []) {
    if (!u.email || !emails.has(u.email)) continue
    const { data: vendor } = await db.from("vendors").select("id").eq("owner_id", u.id).maybeSingle()
    if (vendor) {
      for (const bucket of ["vendor-documents", "vendor-photos", "vendor-menus"]) {
        const files = await listAll(bucket, vendor.id)
        if (files.length) await db.storage.from(bucket).remove(files)
      }
    }
    await must(db.auth.admin.deleteUser(u.id), `delete ${u.email}`)
  }
  await must(db.from("markets").delete().eq("is_sample", true), "delete sample markets")
  await must(db.from("resources").delete().eq("is_sample", true), "delete sample resources")
}

async function main() {
  console.log("Removing old sample data…")
  await removeOldSampleData()

  const vendorIds = new Map<string, string>()
  const vendorDocs = new Map<string, { id: string; doc_type: string; title: string | null; file_path: string; file_name: string; issue_date: string | null; expiration_date: string | null }[]>()
  const marketIds = new Map<string, string>()
  const marketDates = new Map<string, string[]>()

  console.log("Creating sample vendors…")
  for (const v of VENDORS) {
    const { user } = await must(
      db.auth.admin.createUser({ email: v.email, password: PASSWORD, email_confirm: true }),
      `create ${v.email}`
    )
    await must(db.from("profiles").update({ full_name: v.name }).eq("id", user!.id), "profile")
    const vendor = await must(
      db.from("vendors").insert({ ...v.vendor, owner_id: user!.id, is_sample: true }).select("id").single(),
      `vendor ${v.email}`
    )
    vendorIds.set(v.email, vendor.id)
    vendorDocs.set(v.email, [])
    for (const d of v.docs) {
      const path = `${vendor.id}/${crypto.randomUUID()}.pdf`
      await must(
        db.storage.from("vendor-documents").upload(path, samplePdf(d.title ?? d.type), { contentType: "application/pdf" }),
        "upload"
      )
      const expires = d.expiresInDays == null ? null : addDays(today, d.expiresInDays)
      const doc = await must(
        db
          .from("vendor_documents")
          .insert({
            vendor_id: vendor.id,
            doc_type: d.type,
            title: d.title ?? null,
            file_path: path,
            file_name: `sample-${d.type.replace(/_/g, "-")}.pdf`,
            issue_date: expires ? addDays(expires, -365) : addDays(today, -200),
            expiration_date: expires,
          })
          .select("id, doc_type, title, file_path, file_name, issue_date, expiration_date")
          .single(),
        "document"
      )
      vendorDocs.get(v.email)!.push(doc)
    }
    console.log(`  ${v.email}`)
  }

  console.log("Creating sample markets…")
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
          description: `${m.description}\n\n(Sample market for testing. Not a real event.)`,
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
    await must(
      db.from("market_contacts").insert({
        market_id: market.id,
        contact_name: "Sample Organizer",
        contact_email: `organizer+${m.slug}@example.com`,
      }),
      "contact"
    )
    const dates = datesFor(m)
    marketIds.set(m.slug, market.id)
    marketDates.set(m.slug, dates)
    if (dates.length) {
      await must(
        db.from("market_dates").insert(
          dates.map((d) => ({ market_id: market.id, event_date: d, starts_at: m.starts_at, ends_at: m.ends_at }))
        ),
        "dates"
      )
    }
    console.log(`  ${m.name} (${dates.length} dates)`)
  }

  // --- Sample organizer (claims one market) ---------------------------------
  const { user: organizer } = await must(
    db.auth.admin.createUser({ email: ORGANIZER.email, password: PASSWORD, email_confirm: true }),
    "create organizer"
  )
  await must(db.from("profiles").update({ full_name: ORGANIZER.name, is_organizer: true }).eq("id", organizer!.id), "organizer profile")
  await must(db.from("markets").update({ organizer_id: organizer!.id }).eq("slug", CLAIMED_SLUG), "claim market")

  // --- Applications and reviews ----------------------------------------------
  const past = (slug: string, n: number) => marketDates.get(slug)!.filter((d) => d < today).reverse()[n]
  const future = (slug: string, n: number) => marketDates.get(slug)!.filter((d) => d >= today)[n]

  async function apply(opts: {
    vendor: string
    market: string
    dates: (string | undefined)[]
    status: string
    source?: "vendor" | "organizer" | "admin"
    verified?: boolean
    via?: "platform" | "email" | null
    attach?: boolean
    booth?: string
  }) {
    const dates = opts.dates.filter(Boolean) as string[]
    if (!dates.length) return null
    const vendorId = vendorIds.get(opts.vendor)!
    const sent = opts.status !== "draft"
    const app = await must(
      db
        .from("applications")
        .insert({
          vendor_id: vendorId,
          market_id: marketIds.get(opts.market)!,
          status: opts.status,
          status_source: opts.source ?? "vendor",
          event_dates: dates.sort(),
          booth_choice: null,
          note: opts.vendor === "demo-tacos@example.com" ? "We bring our own generator and can stay late for cleanup." : null,
          delivered_via: sent ? (opts.via ?? "email") : null,
          emailed_at: sent && (opts.via ?? "email") === "email" ? new Date().toISOString() : null,
          share_token: sent && (opts.via ?? "email") === "email" ? crypto.randomUUID().replace(/-/g, "") : null,
          share_expires_at: sent ? addDays(today, 14) : null,
          verified_at: opts.verified ? new Date().toISOString() : null,
          booth_number: opts.booth ?? null,
          submitted_at: sent ? new Date(Date.now() - 20 * 86_400_000).toISOString() : null,
        })
        .select("id")
        .single(),
      "application"
    )
    if (opts.attach) {
      for (const doc of vendorDocs.get(opts.vendor)!) {
        const copyPath = `${vendorId}/applications/${app.id}/${crypto.randomUUID()}.pdf`
        await must(db.storage.from("vendor-documents").copy(doc.file_path, copyPath), "copy document")
        await must(
          db.from("application_documents").insert({
            application_id: app.id,
            source_document_id: doc.id,
            doc_type: doc.doc_type,
            title: doc.title,
            file_path: copyPath,
            file_name: doc.file_name,
            issue_date: doc.issue_date,
            expiration_date: doc.expiration_date,
          }),
          "attach document"
        )
      }
    }
    return app.id as string
  }

  console.log("Creating sample applications…")
  const T = "demo-tacos@example.com"
  // The taco truck shows every kind of application.
  const echo = await apply({ vendor: T, market: "sample-echo-lake-sunday-market", dates: [past("sample-echo-lake-sunday-market", 1), future("sample-echo-lake-sunday-market", 1)], status: "accepted", verified: true, attach: true })
  await apply({ vendor: T, market: CLAIMED_SLUG, dates: [future(CLAIMED_SLUG, 1), future(CLAIMED_SLUG, 2)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: T, market: "sample-santa-monica-pier-pop-up", dates: [future("sample-santa-monica-pier-pop-up", 2)], status: "waitlisted", attach: true })
  await apply({ vendor: T, market: "sample-culver-city-twilight-market", dates: [future("sample-culver-city-twilight-market", 0)], status: "declined" })
  await apply({ vendor: T, market: "sample-long-beach-food-truck-fridays", dates: [past("sample-long-beach-food-truck-fridays", 0), future("sample-long-beach-food-truck-fridays", 0)], status: "accepted", attach: true }) // waits for admin verification
  await apply({ vendor: T, market: "sample-pasadena-craft-and-food-fair", dates: [future("sample-pasadena-craft-and-food-fair", 3)], status: "draft" })

  // What the sample organizer sees for DTLA Night Bazaar.
  const D = CLAIMED_SLUG
  await apply({ vendor: "demo-bbq@example.com", market: D, dates: [future(D, 1)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: "demo-coffee@example.com", market: D, dates: [future(D, 1), future(D, 2)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: "demo-icecream@example.com", market: D, dates: [future(D, 1)], status: "accepted", source: "organizer", via: "platform", attach: true, booth: "B4" })
  await apply({ vendor: "demo-vegan@example.com", market: D, dates: [future(D, 1), future(D, 2)], status: "accepted", source: "organizer", via: "platform", attach: true, booth: "A1" })
  await apply({ vendor: "demo-dumplings@example.com", market: D, dates: [future(D, 1)], status: "waitlisted", source: "organizer", via: "platform", attach: true })
  await apply({ vendor: "demo-bakery@example.com", market: D, dates: [future(D, 2)], status: "declined", source: "organizer", via: "platform", attach: true })

  // Payments: DTLA uses its own (sample) payment link; the organizer confirms "I've paid".
  await must(
    db
      .from("markets")
      .update({
        payment_method: "external_link",
        payment_link: "https://example.com/pay/dtla-night-bazaar-sample",
        payment_instructions: "Pay within 7 days of acceptance. Put your business name in the notes. (Sample link, goes nowhere.)",
      })
      .eq("slug", D),
    "dtla payment"
  )
  await must(
    db
      .from("markets")
      .update({ payment_method: "external_link", payment_link: "https://example.com/pay/echo-lake-sample" })
      .eq("slug", "sample-echo-lake-sunday-market"),
    "echo payment"
  )
  for (const [email, status] of [["demo-icecream@example.com", "confirmed"], ["demo-vegan@example.com", "reported"]] as const) {
    const { data: app } = await db
      .from("applications")
      .select("id, vendor_id, market_id")
      .eq("vendor_id", vendorIds.get(email)!)
      .eq("market_id", marketIds.get(D)!)
      .eq("status", "accepted")
      .single()
    if (!app) continue
    await must(
      db.from("payments").insert({
        application_id: app.id,
        market_id: app.market_id,
        vendor_id: app.vendor_id,
        method: "external_link",
        status,
        description: "Paid on the market's own payment page",
        paid_at: status === "confirmed" ? new Date().toISOString() : null,
      }),
      "payment"
    )
    if (status === "confirmed") await must(db.from("applications").update({ status: "paid" }).eq("id", app.id), "mark paid")
  }

  // Sample shared kitchens for the Start page (replace with real ones in Admin → Start hub).
  await must(
    db.from("resources").insert(DEMO_RESOURCES.map((r) => ({ ...r, is_sample: true })), { defaultToNull: false }),
    "sample kitchens"
  )
  // Private deal terms + some example activity for the partner report.
  const { data: partners } = await db.from("resources").select("id, name").eq("is_sample", true).eq("is_partner", true)
  for (const p of partners ?? []) {
    await must(
      db.from("resource_partner_details").insert({
        resource_id: p.id,
        referral_url: `https://example.com/partner/${p.name.toLowerCase().replace(/[^a-z]+/g, "-")}?ref=stallpass`,
        commission_terms: p.name.includes("Insurance") ? "$20 per policy sold (sample deal)" : "$15 per new member (sample deal)",
        contact_name: "Sample Partner Contact",
        contact_email: "partners@example.com",
      }),
      "partner details"
    )
    const events = [...Array(14)].map((_, i) => ({ resource_id: p.id, event: "click", page: i % 3 ? "start" : "readiness" }))
    events.push(...[...Array(5)].map(() => ({ resource_id: p.id, event: "code_copy", page: "start" })))
    await must(db.from("resource_events").insert(events), "partner events")
  }

  // A second organizer: one claim and one brand-new market, both waiting for the admin.
  const { user: organizer2 } = await must(
    db.auth.admin.createUser({ email: ORGANIZER2.email, password: PASSWORD, email_confirm: true }),
    "create organizer 2"
  )
  await must(db.from("profiles").update({ full_name: ORGANIZER2.name, is_organizer: true }).eq("id", organizer2!.id), "organizer 2 profile")
  await must(
    db.from("market_claims").insert({
      market_id: marketIds.get("sample-echo-lake-sunday-market")!,
      user_id: organizer2!.id,
      role: "Market manager",
      evidence_url: "instagram.com/echolakesundaymarket.sample",
      message: "I've managed this market since 2021. Happy to confirm from our official email.",
    }),
    "claim"
  )
  const venice = await must(
    db
      .from("markets")
      .insert({
        slug: "sample-venice-boardwalk-night-market",
        name: "Venice Boardwalk Night Market",
        market_type: "night",
        organizer_name: "Riley (sample organizer)",
        organizer_id: organizer2!.id,
        created_by: organizer2!.id,
        address: "1800 Ocean Front Walk",
        city: "Venice",
        state: "CA",
        zip: "90291",
        lat: 33.985,
        lng: -118.4726,
        schedule_summary: "First Friday of the month, 6pm–10pm",
        description: "New monthly night market on the boardwalk.\n\n(Sample market for testing. Not a real event.)",
        booth_fees: [{ label: "10x10 tent", amount_cents: 9000 }],
        required_doc_types: ["health_permit", "liability_insurance"],
        is_sample: true,
        approval_status: "pending",
      })
      .select("id")
      .single(),
    "pending market"
  )
  await must(
    db.from("market_dates").insert(
      repeatingDates(today, addDays(today, 90), [5])
        .filter((d) => Number(d.slice(8, 10)) <= 7)
        .map((d) => ({ market_id: venice.id, event_date: d, starts_at: "18:00", ends_at: "22:00" }))
    ),
    "pending market dates"
  )

  console.log("Creating sample reviews…")
  let reviewCount = 0
  for (const [vendor, market, idx, [ft, org, val, overall], sales, body, extra] of REVIEWS) {
    const day = past(market, idx)
    if (!day) continue
    const appId =
      vendor === T && market === "sample-echo-lake-sunday-market"
        ? echo
        : await apply({ vendor, market, dates: [day], status: "accepted", source: "admin", verified: true })
    if (!appId) continue
    await must(
      db.from("reviews").insert({
        vendor_id: vendorIds.get(vendor)!,
        market_id: marketIds.get(market)!,
        application_id: appId,
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
        is_hidden: Boolean(extra?.hidden),
        hidden_reason: extra?.hidden ?? null,
        hidden_at: extra?.hidden ? new Date().toISOString() : null,
      }),
      `review ${market}`
    )
    reviewCount++
  }
  console.log(`  ${reviewCount} reviews`)

  // Sales reports: DTLA asks vendors to report (6% of sales); most sample vendors have.
  await must(db.from("markets").update({ sales_reporting: "required", sales_fee_percent: 6 }).eq("slug", CLAIMED_SLUG), "sales settings")
  const { data: pastApps } = await db
    .from("applications")
    .select("id, vendor_id, market_id, event_dates")
    .eq("market_id", marketIds.get(CLAIMED_SLUG)!)
    .in("status", ["accepted", "paid"])
  let salesCount = 0
  for (const [i, a] of (pastApps ?? []).entries()) {
    for (const d of a.event_dates.filter((x: string) => x < today)) {
      if (i % 4 === 3) continue // leave a few unreported, so "Remind" has someone to remind
      const gross = 60000 + ((i * 37 + d.charCodeAt(9) * 13) % 140) * 1000
      await must(
        db.from("sales_reports").insert({
          application_id: a.id,
          market_id: a.market_id,
          vendor_id: a.vendor_id,
          event_date: d,
          gross_sales_cents: gross,
          card_sales_cents: Math.round(gross * 0.78),
          cash_sales_cents: gross - Math.round(gross * 0.78),
          transactions: Math.round(gross / 1400),
          source: i % 2 ? "square" : "manual",
        }),
        "sales report"
      )
      salesCount++
    }
  }
  console.log(`  ${salesCount} sample sales reports`)

  console.log("Creating sample shoppers and shopper reviews…")
  const shopperIds: string[] = []
  for (const sh of SHOPPERS) {
    const { user } = await must(
      db.auth.admin.createUser({ email: sh.email, password: PASSWORD, email_confirm: true }),
      `create ${sh.email}`
    )
    await must(db.from("profiles").update({ full_name: sh.name, is_shopper: true, home_zip: sh.zip }).eq("id", user!.id), "shopper profile")
    shopperIds.push(user!.id)
  }
  for (const [who, slug, daysAgo, [overall, variety, atmosphere, prices], body] of SHOPPER_REVIEWS) {
    await must(
      db.from("shopper_reviews").insert({
        market_id: marketIds.get(slug)!,
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
  console.log(`  ${SHOPPER_REVIEWS.length} shopper reviews`)

  // Sample accounts count as verified, with a password.
  await db.from("profiles").update({ email_verified_at: new Date().toISOString(), has_password: true }).like("email", "demo-%@example.com")

  console.log(`\nDone! Sample logins (password: ${PASSWORD}):`)
  for (const v of VENDORS) console.log(`  ${v.email}`)
  console.log(`  ${ORGANIZER.email} (organizer of DTLA Night Bazaar)`)
  console.log(`  ${ORGANIZER2.email} (organizer with a claim and a new market waiting for approval)`)
  for (const sh of SHOPPERS) console.log(`  ${sh.email} (shopper, home ZIP ${sh.zip})`)
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message)
  process.exit(1)
})
