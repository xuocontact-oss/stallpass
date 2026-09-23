// Tests for document statuses, reminders and market filters.  Run:  npm run test:logic
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { addDays, daysBetween, formatTime, isValidISODate, todayISO } from "../src/lib/dates.ts"
import { documentStatus, reminderKindFor, summarizeDocuments } from "../src/lib/documents.ts"
import {
  dateRange,
  filterMarkets,
  parseBoothFees,
  parseFilters,
  repeatingDates,
  slugify,
} from "../src/lib/markets.ts"
import { DOCUMENT_TYPES, FOOD_CATEGORIES } from "../src/lib/constants.ts"
import type { Market, MarketDate } from "../src/lib/types.ts"

const TODAY = "2026-09-22" // a Tuesday

test("date helpers", () => {
  assert.equal(daysBetween("2026-09-22", "2026-10-22"), 30)
  assert.equal(daysBetween("2026-09-22", "2026-09-21"), -1)
  assert.equal(addDays("2026-12-31", 1), "2027-01-01")
  assert.equal(isValidISODate("2026-02-30"), false)
  assert.equal(isValidISODate("2028-02-29"), true)
  assert.equal(formatTime("09:00:00"), "9am")
  assert.equal(formatTime("17:30"), "5:30pm")
  // 11pm in LA on Sep 22 is already Sep 23 in UTC; "today" must stay Sep 22.
  assert.equal(todayISO("America/Los_Angeles", new Date("2026-09-23T06:00:00Z")), "2026-09-22")
})

test("document status", () => {
  assert.equal(documentStatus(null, TODAY), "no_expiry")
  assert.equal(documentStatus("2026-09-21", TODAY), "expired")
  assert.equal(documentStatus("2026-09-22", TODAY), "expiring") // last valid day
  assert.equal(documentStatus("2026-10-22", TODAY), "expiring") // 30 days
  assert.equal(documentStatus("2026-10-23", TODAY), "valid") // 31 days
  assert.deepEqual(
    summarizeDocuments(
      [{ expiration_date: "2020-01-01" }, { expiration_date: "2030-01-01" }, { expiration_date: null }],
      TODAY
    ),
    { valid: 1, expiring: 0, expired: 1, no_expiry: 1 }
  )
})

test("reminder timing", () => {
  assert.equal(reminderKindFor(31), null)
  assert.equal(reminderKindFor(30), "30_day")
  assert.equal(reminderKindFor(8), "30_day")
  assert.equal(reminderKindFor(7), "7_day")
  assert.equal(reminderKindFor(0), "7_day")
  assert.equal(reminderKindFor(-1), null)
})

test("booth fee parsing", () => {
  assert.deepEqual(parseBoothFees("10x10 tent: $75\nFood truck | 150.50\n\n"), {
    fees: [
      { label: "10x10 tent", amount_cents: 7500 },
      { label: "Food truck", amount_cents: 15050 },
    ],
  })
  assert.ok("error" in parseBoothFees("just words"))
  assert.deepEqual(parseBoothFees(""), { fees: [] })
})

test("slugs and repeating dates", () => {
  assert.equal(slugify("Silver Lake Night Market!"), "silver-lake-night-market")
  assert.equal(slugify("Café Olé"), "cafe-ole")
  // Sundays (0) in October 2026
  assert.deepEqual(repeatingDates("2026-10-01", "2026-10-31", [0]), [
    "2026-10-04",
    "2026-10-11",
    "2026-10-18",
    "2026-10-25",
  ])
  assert.equal(repeatingDates("2026-01-01", "2030-01-01", [0, 1, 2, 3, 4, 5, 6]).length, 104)
})

test("weekend range", () => {
  // Tuesday → coming Sat–Sun
  assert.deepEqual(dateRange(parseFilters({ when: "weekend" }), TODAY), { from: "2026-09-26", to: "2026-09-27" })
  // Sunday → just today
  assert.deepEqual(dateRange(parseFilters({ when: "weekend" }), "2026-09-27"), { from: "2026-09-27", to: "2026-09-27" })
})

function market(id: string, extra: Partial<Market> = {}): Market {
  return {
    id, slug: id, name: `Market ${id}`, market_type: "farmers", organizer_name: null, organizer_id: null,
    is_claimed: false, website: null, instagram: null, address: "x", city: "Los Angeles", state: "CA",
    zip: null, lat: 34.05, lng: -118.25, description: null, schedule_summary: null, booth_fees: [],
    min_booth_fee_cents: null, categories_wanted: [], required_doc_types: [], application_deadline: null,
    application_notes: null, is_published: true, is_sample: false, approval_status: "approved", rejection_reason: null, source: "stallpass", source_id: null, payment_method: "none", payment_link: null, payment_instructions: null,
    created_by: null, approved_at: null, created_at: "", updated_at: "", ...extra,
  }
}
const date = (market_id: string, event_date: string): MarketDate =>
  ({ id: `${market_id}-${event_date}`, market_id, event_date, starts_at: null, ends_at: null, note: null })

test("bounding box", async () => {
  const { boundingBox, distanceMiles } = await import("../src/lib/markets.ts")
  const o = { lat: 34.05, lng: -118.25 }
  const b = boundingBox(o, 25)
  // Points 25 miles due north / east sit on the box edge
  assert.ok(Math.abs(distanceMiles(o, { lat: b.maxLat, lng: o.lng }) - 25) < 0.5)
  assert.ok(Math.abs(distanceMiles(o, { lat: o.lat, lng: b.maxLng }) - 25) < 0.5)
})

test("market filters", () => {
  const markets = [
    market("dtla", { min_booth_fee_cents: 5000, categories_wanted: ["tacos_mexican"] }),
    market("santa-monica", { lat: 34.0195, lng: -118.4912, min_booth_fee_cents: 20000 }),
    market("long-beach", { lat: 33.7701, lng: -118.1937, city: "Long Beach" }),
  ]
  const dates = [date("dtla", "2026-09-26"), date("santa-monica", "2026-10-15"), date("long-beach", "2026-09-01")]
  const run = (params: Record<string, string>) =>
    filterMarkets(markets, dates, parseFilters(params), TODAY).map((r) => r.market.id)
  const SANTA_MONICA = { lat: "34.0195", lng: "-118.4912" }
  const DTLA = { lat: "34.0488", lng: "-118.2518" }

  assert.deepEqual(run({}), ["dtla", "santa-monica", "long-beach"]) // no upcoming date → last
  assert.deepEqual(run({ when: "weekend" }), ["dtla"])
  assert.deepEqual(run({ when: "30" }), ["dtla", "santa-monica"])
  assert.deepEqual(run({ category: "bbq_grill" }), ["santa-monica", "long-beach"]) // dtla only wants tacos
  assert.deepEqual(run({ maxFee: "100" }), ["dtla", "long-beach"]) // unknown fee is kept
  assert.deepEqual(run({ ...SANTA_MONICA, miles: "10" }), ["santa-monica"])
  assert.deepEqual(run({ ...DTLA, miles: "25" }), ["dtla", "santa-monica", "long-beach"]) // sorted by distance
  // A ZIP's point is passed in by the page
  assert.deepEqual(
    filterMarkets(markets, dates, parseFilters({ zip: "90802", miles: "10" }), TODAY, { lat: 33.77, lng: -118.19 }).map((r) => r.market.id),
    ["long-beach"]
  )
  assert.deepEqual(run({ q: "long beach" }), ["long-beach"])
  assert.deepEqual(run({ miles: "999", maxFee: "abc", when: "junk" }), ["dtla", "santa-monica", "long-beach"])
})

test("code lists match the database", () => {
  const sql = fs
    .readdirSync("supabase/migrations")
    .map((f) => fs.readFileSync(`supabase/migrations/${f}`, "utf8"))
    .join("\n")
  for (const { key } of [...FOOD_CATEGORIES, ...DOCUMENT_TYPES]) {
    assert.ok(sql.includes(`('${key}',`), `${key} is missing from the database lists`)
  }
})

test("menu text clean-up", async () => {
  const { tidyMenuText } = await import("../src/lib/menu-text.ts")
  assert.equal(tidyMenuText("Carne Asada Taco ........ 4.00"), "Carne Asada Taco – $4.00")
  assert.equal(tidyMenuText("Horchata - $5"), "Horchata – $5")
  assert.equal(tidyMenuText("Quesabirria (3): S14.00"), "Quesabirria (3) – $14.00")
  assert.equal(tidyMenuText("Combo 2"), "Combo 2") // a plain number isn't a price
  assert.equal(
    tidyMenuText("  TACOS  \n|||\n~\nAl   pastor   4.50\n\n\n\nDRINKS\nJamaica $4\n"),
    "TACOS\nAl pastor – $4.50\n\nDRINKS\nJamaica – $4"
  )
  // Real text-recognition output from a sample menu photo
  assert.equal(
    tidyMenuText("TACOS\n\nCarne Asada Taco ........ 4.00\n\nAl Pastor Taco ........ 4.00\n\nDRINKS\n\nHorchata...... $5\n"),
    "TACOS\nCarne Asada Taco – $4.00\nAl Pastor Taco – $4.00\n\nDRINKS\nHorchata – $5"
  )
})

test("keep only menu items with prices", async () => {
  const { onlyPricedLines } = await import("../src/lib/menu-text.ts")
  assert.equal(
    onlyPricedLines("LA ESQUINA TACOS\nOpen Fri–Sun 11am–9pm\n(323) 555-0100\nTACOS\nAl pastor – $4.50\n\nHorchata – $5"),
    "Al pastor – $4.50\nHorchata – $5"
  )
})

test("readiness check", async () => {
  const { checkReadiness, defaultAttachments } = await import("../src/lib/readiness.ts")
  const docs = [
    { id: "hp-old", doc_type: "health_permit", title: null, expiration_date: "2026-01-01" },
    { id: "hp-new", doc_type: "health_permit", title: null, expiration_date: "2027-06-01" },
    { id: "ins", doc_type: "liability_insurance", title: null, expiration_date: "2026-10-05" },
    { id: "bl", doc_type: "business_license", title: null, expiration_date: "2026-09-01" },
    { id: "sp", doc_type: "sellers_permit", title: null, expiration_date: null },
  ]
  const required = ["health_permit", "liability_insurance", "business_license", "sellers_permit", "food_handler_card"]
  const { items, ready } = checkReadiness(required, docs, ["2026-10-10", "2026-10-03"], TODAY)
  assert.deepEqual(
    items.map((i) => [i.docType, i.status, i.document?.id ?? null]),
    [
      ["health_permit", "ready", "hp-new"], // picks the newer copy
      ["liability_insurance", "expires_before_event", "ins"], // valid today, not on Oct 10
      ["business_license", "expired", "bl"],
      ["sellers_permit", "ready", "sp"], // never expires
      ["food_handler_card", "missing", null],
    ]
  )
  assert.equal(ready, false)
  assert.deepEqual(defaultAttachments(items), ["hp-new", "ins", "sp"])
  assert.equal(checkReadiness([], docs, [], TODAY).ready, true)
})

test("review summary", async () => {
  const { summarizeReviews } = await import("../src/lib/reviews.ts")
  const r = (o: number, s: string | null) =>
    ({ rating_overall: o, rating_foot_traffic: 5, rating_organization: 3, rating_value: 4, sales_range: s }) as never
  const s = summarizeReviews([r(5, "700_1500"), r(4, null), r(4, "700_1500")])
  assert.equal(s.count, 3)
  assert.equal(s.overall, 4.3)
  assert.equal(s.sales["700_1500"], 2)
  assert.equal(s.salesCount, 2)
  assert.equal(summarizeReviews([]).overall, null)
})

test("booth fee and platform fee", async () => {
  const { boothFeeTotal, platformFee } = await import("../src/lib/fees.ts")
  const fees = [
    { label: "10x10 tent", amount_cents: 7500 },
    { label: "Food truck", amount_cents: 15000 },
  ]
  assert.deepEqual(boothFeeTotal(fees, "Food truck", 2), { perDate: 15000, total: 30000, label: "Food truck" })
  assert.equal(boothFeeTotal(fees, null, 1)?.total, 7500) // cheapest when none chosen
  assert.equal(boothFeeTotal([], "x", 1), null)
  assert.equal(platformFee(10000, 5, 0), 500)
  assert.equal(platformFee(7500, 3.5, 30), 293) // 262.5 → 263 + 30
  assert.equal(platformFee(100, 50, 1000), 100) // never more than the payment
  assert.equal(platformFee(10000, 0, 0), 0)
})

test("vendor setup progress", async () => {
  const { vendorSetupProgress } = await import("../src/lib/setup-progress.ts")
  const food = { category: "tacos_mexican", phone: "213", description: "x", menu: null }
  let p = vendorSetupProgress(food, [{ doc_type: "health_permit" }])
  assert.equal(p.nextStep, 2) // menu missing
  assert.equal(p.docsTotal, 5)
  p = vendorSetupProgress({ ...food, menu: "Tacos $4" }, [{ doc_type: "health_permit" }])
  assert.equal(p.nextStep, 3)
  const goods = { category: "vintage", phone: "213", description: "x", menu: "Jeans $40" }
  p = vendorSetupProgress(goods, ["liability_insurance", "business_license", "sellers_permit"].map((doc_type) => ({ doc_type })))
  assert.equal(p.complete, true) // non-food sellers don't need a health permit
  assert.equal(vendorSetupProgress(null, []).nextStep, 1)
})
